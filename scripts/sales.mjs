// First Class sales counter — run by GitHub Actions (.github/workflows/sales.yml) every 30 minutes.
//
// For the current tripleS season, counts how many copies of each member's First Class objekts were
// sold (minted) during that member's 24-hour sale, per edition:
//   1st edition 101Z–108Z · 2nd edition 109Z–116Z · 3rd edition 117Z–120Z
// Sale start times come from sales-config.json, which the website's Sales tab saves (as admin).
//
// Copies won from a spin are left out of the sales count and counted separately. A copy counts as a
// spin win when its new owner's previous move on the chain was sending a card to COSMO's spin wallet
// (this also covers a spin where both happen in the same transaction).
//
// Writes data/sales.json for the website, and data/sales-state.json to remember work between runs.
// Env: OPENSEA_KEY (used to list each member's copies), RPC_URLS, TIME_BUDGET_MIN.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rpc } from "./contest.mjs";

const CONTRACT = "0x99bb83ae9bb0c0a6be865cacf67760947f91cb70";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO32 = "0x" + "0".repeat(64);
const SPIN_WALLET = "0xd3d5f29881ad87bb10c1100e2c709c9596de345f";
const SPIN_TOPIC = "0x" + SPIN_WALLET.slice(2).padStart(64, "0");
const OPENSEA_SLUG = "objekt-2";
export const EDITIONS = {
  1: { name: "1st edition", colls: range(101, 108) },
  2: { name: "2nd edition", colls: range(109, 116) },
  3: { name: "3rd edition", colls: range(117, 120) },
};
const WINDOW_MS = 24 * 3600_000;

const CONFIG_FILE = process.env.SALES_CONFIG || "sales-config.json";
const OUT_FILE = process.env.OUT_FILE || "data/sales.json";
const STATE_FILE = process.env.STATE_FILE || "data/sales-state.json";
const BUDGET_MS = Number(process.env.TIME_BUDGET_MIN || 25) * 60_000;
const started = Date.now();
const outOfTime = (margin = 0) => Date.now() - started > BUDGET_MS - margin;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const topicOf = id => "0x" + BigInt(id).toString(16).padStart(64, "0");
const addrTopic = a => "0x" + a.slice(2).toLowerCase().padStart(64, "0");
function range(a, b) { const out = []; for (let n = a; n <= b; n++) out.push(n + "Z"); return out; }
async function readJSON(f, fallback) { try { return JSON.parse(await readFile(f, "utf8")); } catch { return fallback; } }
const before = (a, b) => a.block < b.block || (a.block === b.block && a.li < b.li);   // chain order

/* ---------- each member's copies of one collection, from OpenSea (Member + Collection traits) ---------- */
export async function listMemberCopies(season, member, coll) {
  const key = process.env.OPENSEA_KEY;
  if (!key) throw new Error("OPENSEA_KEY is not set");
  const traits = JSON.stringify([{ traitType: "Member", value: member }, { traitType: "Collection", value: coll }]);
  const want = `${season} ${member} ${coll}`.toLowerCase();
  const out = [];
  let next = null, retries = 0;
  for (let page = 0; page < 2000; ) {
    const url = new URL(`https://api.opensea.io/api/v2/collection/${OPENSEA_SLUG}/nfts`);
    url.searchParams.set("limit", "200");
    url.searchParams.set("traits", traits);
    if (next) url.searchParams.set("next", next);
    let r;
    try { r = await fetch(url, { headers: { "X-API-KEY": key, accept: "application/json" } }); }
    catch (e) { if (retries++ < 5) { await sleep(2000 * retries); continue; } throw e; }
    if (r.status === 429) { await sleep(3000); continue; }
    if (r.status >= 500 && retries < 5) { retries++; await sleep(2000 * retries); continue; }
    if (!r.ok) throw new Error(`OpenSea ${r.status} for ${member} ${coll}: ${(await r.text()).slice(0, 200)}`);
    retries = 0;
    const j = await r.json();
    // names look like "Cream02 ChaeWon 372Z #12345": keep only this season (other seasons share the number)
    for (const n of j.nfts || []) if ((n.name || "").replace(/\s*#\d+$/, "").trim().toLowerCase() === want) out.push(String(n.identifier));
    next = j.next || null; page++;
    if (!next) break;
    await sleep(250);
  }
  return out;
}

/* ---------- block number at a moment in time (first block at or after it) ---------- */
const blockTimes = new Map();
async function blockTime(n) {
  if (!blockTimes.has(n)) blockTimes.set(n, Number((await rpc("eth_getBlockByNumber", ["0x" + n.toString(16), false])).timestamp) * 1000);
  return blockTimes.get(n);
}
export async function blockAt(ms, latest) {
  if (ms > await blockTime(latest)) return latest + 1;   // in the future
  let lo = 0, hi = latest;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (await blockTime(mid) >= ms) hi = mid; else lo = mid + 1; }
  return lo;
}

/* ---------- getLogs over a block range, splitting the range if the node refuses ---------- */
async function logsInRange(topics, from, to) {
  const out = [];
  const stack = [[from, to]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (a > b) continue;
    try {
      out.push(...await rpc("eth_getLogs", [{ address: CONTRACT, fromBlock: "0x" + a.toString(16), toBlock: "0x" + b.toString(16), topics }]));
    } catch (e) {
      if (b - a < 1) throw e;
      const m = Math.floor((a + b) / 2); stack.push([m + 1, b], [a, m]);
    }
  }
  return out.map(l => ({ block: Number(l.blockNumber), li: Number(l.logIndex), tx: l.transactionHash,
    from: "0x" + l.topics[1].slice(26), to: "0x" + l.topics[2].slice(26), id: BigInt(l.topics[3]).toString() }));
}

/* ---------- mint (= sale) of each copy: who to, and where in the chain ---------- */
async function lookupMints(ids, cache) {
  const todo = ids.filter(id => !cache[id]);
  let size = 100;
  for (let i = 0; i < todo.length; ) {
    if (outOfTime(3 * 60_000)) { log(`  out of time after ${i}/${todo.length} mints`); return false; }
    const chunk = todo.slice(i, i + size);
    try {
      const logs = await rpc("eth_getLogs", [{ address: CONTRACT, fromBlock: "0x0", toBlock: "latest", topics: [TRANSFER, ZERO32, null, chunk.map(topicOf)] }]);
      for (const l of logs) cache[BigInt(l.topics[3]).toString()] = { to: "0x" + l.topics[2].slice(26), block: Number(l.blockNumber), li: Number(l.logIndex), tx: l.transactionHash };
      i += chunk.length;
    } catch (e) {
      if (size > 5) { size = Math.max(5, Math.floor(size / 2)); continue; }
      log(`  skipping ${chunk.length} ids: ${e.message}`); i += chunk.length;
    }
  }
  return true;
}

/* ---------- spin wins: was the new owner's previous move sending a card to the spin wallet? ---------- */
async function spinCheck(mint, spinsByWallet) {
  const sends = (spinsByWallet.get(mint.to) || []).filter(s => before(s, mint));
  if (!sends.length) return false;
  const last = sends[sends.length - 1];
  // any other transfer to or from this wallet between that spin and this mint means the spin wasn't the previous move
  const [outs, ins] = await Promise.all([
    logsInRange([TRANSFER, addrTopic(mint.to)], last.block, mint.block),
    logsInRange([TRANSFER, null, addrTopic(mint.to)], last.block, mint.block),
  ]);
  return ![...outs, ...ins].some(e => before(last, e) && before(e, mint));
}

export async function main() {
  const config = await readJSON(CONFIG_FILE, null);
  const season = config?.current;
  if (!season || !config.seasons?.[season]) { log("No sales set up yet (sales-config.json) — nothing to do."); return; }
  await mkdir(OUT_FILE.replace(/\/[^/]+$/, "") || ".", { recursive: true });
  const state = await readJSON(STATE_FILE, {});
  const prevOut = await readJSON(OUT_FILE, null);
  const now = Date.now();
  const latest = Number(await rpc("eth_blockNumber", []));
  const latestTime = await blockTime(latest);

  const out = { updated: new Date().toISOString(), chainTime: new Date(latestTime).toISOString(), current: season,
    seasons: Object.keys(config.seasons), data: { ...(prevOut?.data || {}) } };

  // every season in the config is shown; only ones with a live or newly ended sale do any work
  for (const [sName, sConf] of Object.entries(config.seasons)) {
    const st = (state[sName] ||= { copies: {}, mints: {}, spin: {}, final: {}, blocks: {} });
    const prevSeason = prevOut?.data?.[sName];
    const result = { editions: {} };
    for (const [ed, def] of Object.entries(EDITIONS)) {
      const starts = sConf.windows?.[ed] || {};
      const members = [];
      for (const member of Object.keys(starts)) {
        const start = Date.parse(starts[member]);
        if (!Number.isFinite(start)) continue;
        const end = start + WINDOW_MS, key = `${ed}|${member}|${start}`;
        const row = { member, start: new Date(start).toISOString(), end: new Date(end).toISOString(),
          status: now < start ? "upcoming" : latestTime < end ? "live" : "ended", sold: 0, spinWins: 0, perColl: {} };
        const old = prevSeason?.editions?.[ed]?.members?.find(m => m.member === member && m.start === row.start);
        if (row.status === "upcoming") { members.push(row); continue; }
        if (st.final[key] && old) { members.push({ ...old, status: "ended" }); continue; }
        if (outOfTime(5 * 60_000)) { members.push(old ? { ...old, status: row.status, stale: true } : { ...row, stale: true }); continue; }

        log(`${sName} ${def.name} · ${member} (${row.status})`);
        try {
          // window → block range
          const b0 = st.blocks[row.start] ??= await blockAt(start, latest);
          const b1 = row.status === "ended" ? (st.blocks[row.end] ??= await blockAt(end, latest)) : latest + 1;

          // this member's copies of the edition's collections, and where each was minted
          const ids = [];
          for (const coll of def.colls) {
            const ck = `${member}|${coll}`;
            if (!st.copies[ck] || row.status === "live" || !st.final[key]) st.copies[ck] = await listMemberCopies(sName, member, coll);
            ids.push(...st.copies[ck].map(id => [id, coll]));
          }
          const done = await lookupMints(ids.map(x => x[0]), st.mints);

          // sales in the window, and the spin sends that could explain some of them
          const inWindow = ids.filter(([id]) => { const m = st.mints[id]; return m && m.block >= b0 && m.block < b1; });
          const spins = inWindow.length ? await logsInRange([TRANSFER, null, SPIN_TOPIC], Math.max(0, b0 - 50), Math.min(b1, latest)) : [];
          const spinsByWallet = new Map();
          for (const s of spins) { if (!spinsByWallet.has(s.from)) spinsByWallet.set(s.from, []); spinsByWallet.get(s.from).push(s); }
          for (const list of spinsByWallet.values()) list.sort((a, b) => before(a, b) ? -1 : 1);

          for (const [id, coll] of inWindow) {
            if (!(id in st.spin)) {
              if (outOfTime(2 * 60_000)) break;
              st.spin[id] = await spinCheck(st.mints[id], spinsByWallet);
            }
            const pc = (row.perColl[coll] ||= { sold: 0, spinWins: 0 });
            if (st.spin[id]) { row.spinWins++; pc.spinWins++; } else { row.sold++; pc.sold++; }
          }
          row.checked = inWindow.every(([id]) => id in st.spin) && done;
          if (row.status === "ended" && row.checked) st.final[key] = true;
          members.push(row);
        } catch (e) {
          log(`  failed: ${e.message}`);
          members.push(old ? { ...old, status: row.status, stale: true } : { ...row, stale: true, error: e.message });
        }
        await writeFile(STATE_FILE, JSON.stringify(state));
      }
      result.editions[ed] = { name: def.name, colls: def.colls, members,
        sold: members.reduce((a, m) => a + (m.sold || 0), 0), spinWins: members.reduce((a, m) => a + (m.spinWins || 0), 0) };
    }
    out.data[sName] = result;
  }
  for (const s of Object.keys(out.data)) if (!config.seasons[s]) delete out.data[s];
  await writeFile(STATE_FILE, JSON.stringify(state));
  // nothing new (e.g. no sale on): leave the file alone so the site isn't republished for nothing
  const same = prevOut && JSON.stringify(prevOut.data) === JSON.stringify(out.data) && prevOut.current === out.current
    && JSON.stringify(prevOut.seasons) === JSON.stringify(out.seasons) && !Object.values(out.data).some(sd => Object.values(sd.editions).some(e => e.members.some(m => m.status === "live")));
  if (same) { log("No change"); return; }
  await writeFile(OUT_FILE, JSON.stringify(out));
  log(`Saved ${OUT_FILE}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
