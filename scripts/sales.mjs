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
// How: every copy minted since the first sale started is read from the chain, and COSMO's metadata says
// which season/member/collection it is, so brand-new copies count straight away (no OpenSea needed).
// Env: RPC_URLS, TIME_BUDGET_MIN.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rpc } from "./contest.mjs";
import { fetchMeta } from "./crawl-meta.mjs";

const CONTRACT = "0x99bb83ae9bb0c0a6be865cacf67760947f91cb70";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO32 = "0x" + "0".repeat(64);
const SPIN_WALLET = "0xd3d5f29881ad87bb10c1100e2c709c9596de345f";
const SPIN_TOPIC = "0x" + SPIN_WALLET.slice(2).padStart(64, "0");
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

/* ---------- what each new copy is (season, member, collection, class), from COSMO's metadata ---------- */
const META_RPS = Number(process.env.COSMO_RPS || 15), META_PARALLEL = 6;
let nextSlot = 0;
async function slot() { const now = Date.now(), at = Math.max(now, nextSlot); nextSlot = at + 1000 / META_RPS; if (at > now) await sleep(at - now); }
async function metaWithRetry(id) {
  for (let attempt = 0; ; attempt++) {
    await slot();
    try { return await fetchMeta(id); }
    catch (e) { if (attempt >= 4) return undefined; await sleep((e.status === 429 ? 8000 : 1500) * (attempt + 1)); }
  }
}
async function metaMany(ids) {   // → Map id → meta | null (not an objekt) | undefined (couldn't fetch this time)
  const out = new Map(); let i = 0;
  await Promise.all(Array.from({ length: META_PARALLEL }, async () => { while (i < ids.length) { const id = ids[i++]; out.set(id, await metaWithRetry(id)); } }));
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

/* ---------- read new mints from the chain and keep this season's First Class copies ---------- */
async function scanMints(st, season, members, fromBlock, toBlock) {
  const wantColls = new Set(Object.values(EDITIONS).flatMap(e => e.colls));
  const wantMembers = new Set(members.map(m => m.toLowerCase()));
  st.scanned ??= fromBlock;
  if (st.scanned < fromBlock) st.scanned = fromBlock;
  let step = 2000, seen = 0, kept = 0;
  // copies whose metadata couldn't be fetched last time get another go first
  const retry = Object.keys(st.retry || {});
  if (retry.length) {
    const metas = await metaMany(retry);
    for (const id of retry) { const m = metas.get(id); if (m === undefined) continue; keep(id, st.retry[id], m); delete st.retry[id]; }
  }
  function keep(id, mint, m) {
    if (!m || m.season.toLowerCase() !== season.toLowerCase() || !wantColls.has(m.coll.toUpperCase())
      || !wantMembers.has(m.member.toLowerCase()) || (m.cls && m.cls.toLowerCase() !== "first")) return;
    st.mints[id] = { ...mint, m: m.member, c: m.coll.toUpperCase() }; kept++;
  }
  while (st.scanned <= toBlock && !outOfTime(4 * 60_000)) {
    const a = st.scanned, b = Math.min(toBlock, a + step - 1);
    let logs;
    try { logs = await rpc("eth_getLogs", [{ address: CONTRACT, fromBlock: "0x" + a.toString(16), toBlock: "0x" + b.toString(16), topics: [TRANSFER, ZERO32] }]); }
    catch (e) { if (step > 50) { step = Math.floor(step / 2); continue; } throw e; }
    const mints = logs.map(l => [BigInt(l.topics[3]).toString(), { to: "0x" + l.topics[2].slice(26), block: Number(l.blockNumber), li: Number(l.logIndex), tx: l.transactionHash }]);
    const metas = await metaMany(mints.map(x => x[0]));
    for (const [id, mint] of mints) {
      const m = metas.get(id);
      if (m === undefined) (st.retry ||= {})[id] = mint; else keep(id, mint, m);
    }
    seen += mints.length; st.scanned = b + 1;
    if (logs.length < 300 && step < 20000) step *= 2;   // quiet stretch: take bigger steps
  }
  log(`  scanned to block ${st.scanned - 1}: ${seen.toLocaleString()} new mints, ${kept} for ${season} First Class`);
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

  for (const [sName, sConf] of Object.entries(config.seasons)) {
    const st = state[sName] = { mints: {}, spin: {}, final: {}, blocks: {}, ...(state[sName] || {}) };
    delete st.copies;   // from the old OpenSea version
    const prevSeason = prevOut?.data?.[sName];

    // every member's sale in this season, with its block range
    const sales = [];
    for (const [ed, def] of Object.entries(EDITIONS)) for (const [member, iso] of Object.entries(sConf.windows?.[ed] || {})) {
      const start = Date.parse(iso); if (!Number.isFinite(start)) continue;
      const end = start + WINDOW_MS;
      sales.push({ ed, def, member, start, end, key: `${ed}|${member}|${start}`,
        status: now < start ? "upcoming" : latestTime < end ? "live" : "ended" });
    }
    const active = sales.filter(x => x.status !== "upcoming" && !st.final[x.key]);
    let scanErr = null;
    if (active.length) {
      log(`${sName}: ${active.length} sale(s) to count`);
      try {
        for (const x of active) {
          x.b0 = st.blocks[new Date(x.start).toISOString()] ??= await blockAt(x.start, latest);
          x.b1 = x.status === "ended" ? (st.blocks[new Date(x.end).toISOString()] ??= await blockAt(x.end, latest)) : latest + 1;
        }
        const from = Math.min(...active.map(x => x.b0)), to = Math.min(latest, Math.max(...active.map(x => x.b1 - 1)));
        const members = [...new Set(sales.map(x => x.member))];
        await scanMints(st, sName, members, from, to);
      } catch (e) { scanErr = e.message; log(`  scan failed: ${e.message}`); }
    }

    const result = { editions: {} };
    for (const [ed, def] of Object.entries(EDITIONS)) {
      const members = [];
      for (const x of sales.filter(y => y.ed === ed)) {
        const row = { member: x.member, start: new Date(x.start).toISOString(), end: new Date(x.end).toISOString(),
          status: x.status, sold: 0, spinWins: 0, perColl: {} };
        const old = prevSeason?.editions?.[ed]?.members?.find(m => m.member === x.member && m.start === row.start);
        if (x.status === "upcoming") { members.push(row); continue; }
        if (st.final[x.key] && old) { members.push({ ...old, status: "ended" }); continue; }
        if (x.b0 == null) { members.push({ ...(old || row), status: x.status, stale: true, ...(scanErr ? { error: scanErr } : {}) }); continue; }

        // this member's sale copies minted inside her 24 hours
        const inWindow = Object.entries(st.mints).filter(([, m]) => m.m.toLowerCase() === x.member.toLowerCase() && def.colls.includes(m.c) && m.block >= x.b0 && m.block < x.b1);
        let spinsByWallet = null;
        for (const [id, mint] of inWindow) {
          if (!(id in st.spin) && !outOfTime(2 * 60_000)) {
            if (!spinsByWallet) {
              const spins = await logsInRange([TRANSFER, null, SPIN_TOPIC], Math.max(0, x.b0 - 50), Math.min(x.b1, latest));
              spinsByWallet = new Map();
              for (const s of spins) { if (!spinsByWallet.has(s.from)) spinsByWallet.set(s.from, []); spinsByWallet.get(s.from).push(s); }
              for (const list of spinsByWallet.values()) list.sort((a, b) => before(a, b) ? -1 : 1);
            }
            try { st.spin[id] = await spinCheck(mint, spinsByWallet); } catch (e) { log(`  spin check failed: ${e.message}`); }
          }
          const pc = (row.perColl[mint.c] ||= { sold: 0, spinWins: 0 });
          if (st.spin[id]) { row.spinWins++; pc.spinWins++; } else { row.sold++; pc.sold++; }
        }
        const scannedAll = (st.scanned ?? 0) >= Math.min(x.b1, latest + 1) && !Object.keys(st.retry || {}).length;
        row.checked = scannedAll && inWindow.every(([id]) => id in st.spin);
        if (!row.checked) row.stale = true;
        if (scanErr) row.error = scanErr;
        if (x.status === "ended" && row.checked) st.final[x.key] = true;
        members.push(row);
      }
      result.editions[ed] = { name: def.name, colls: def.colls, members,
        sold: members.reduce((a, m) => a + (m.sold || 0), 0), spinWins: members.reduce((a, m) => a + (m.spinWins || 0), 0) };
    }
    // copies from finished sales are no longer needed
    if (sales.length && sales.every(x => x.status === "ended" && st.final[x.key])) st.mints = {};
    out.data[sName] = result;
    await writeFile(STATE_FILE, JSON.stringify(state));
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
