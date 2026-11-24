// Objekt contest indexer — run by GitHub Actions on a schedule (or locally: `node scripts/contest.mjs`).
// Works out, for each member, which wallets bought (were minted) / hold the most copies of the
// contest collections combined, and writes the result to data/contest.json for the website to load.
//
// Needs Node 18+ (built-in fetch). No npm packages.
// Env: OPENSEA_KEY (required) — add it as a repository secret in GitHub.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadAll } from "./crawl-meta.mjs";

/* ===== Default contest — normally set from the website instead (Contest tab → "Make this the hourly contest", saved to contest-config.json) ===== */
export const CONFIG = {
  season: "Cream02",
  collections: ["372Z", "373Z", "374Z"],
  topPerMember: 100,                 // how many wallets to keep per member in contest.json
  checkHolders: true,                // also rank by current holders (slower); false = buyers only
};

const CONTRACT = "0x99bb83ae9bb0c0a6be865cacf67760947f91cb70"; // tripleS / ARTMS Objekt on Abstract
const OPENSEA_SLUG = "objekt-2";
const RPCS = (process.env.RPC_URLS || "https://api.mainnet.abs.xyz,https://abstract.api.onfinality.io/public").split(",");
const OUT_FILE = process.env.OUT_FILE || "data/contest.json";
const STATE_FILE = process.env.STATE_FILE || "data/contest-state.json";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO32 = "0x" + "0".repeat(64);
const MULTICALL_CANDIDATES = [
  "0xAa4De41dba0Ca5dCBb288b7cC6b708F3aaC759E7",
  "0xF9cda624FBC7e059355ce98a31693d299FACd963",
  "0xcA11bde05977b3631167028862bE2a173976CA11",
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Stop looking things up after this many minutes and save what we have; the next run continues.
// (GitHub kills the job at 60 min, and anything unsaved would be lost.)
const BUDGET_MS = Number(process.env.TIME_BUDGET_MIN || 45) * 60_000;
let deadline = Date.now() + BUDGET_MS;
export const setDeadline = ms => { deadline = Date.now() + ms; };
const outOfTime = (marginMs = 0) => Date.now() > deadline - marginMs;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pad64 = h => h.padStart(64, "0");
const topicOf = id => "0x" + pad64(BigInt(id).toString(16));

/* ===== JSON-RPC with throttling, retries and endpoint rotation ===== */
let rpcIdx = 0, lastCall = 0, rpcId = 1;
const MIN_GAP_MS = Number(process.env.RPC_GAP_MS || 250);

export async function rpc(method, params) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const r = await fetch(RPCS[rpcIdx], { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) {
        const e = new Error(j.error.message || "RPC error");
        if (!/limit|too many|rate/i.test(e.message)) { e.fatal = true; throw e; } // e.g. "too many results": caller shrinks
        throw e;
      }
      return j.result;
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
      rpcIdx = (rpcIdx + 1) % RPCS.length;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

/* ===== Step 1: every copy of each contest collection, from OpenSea ===== */
export async function listCopies(season, coll) {
  const key = process.env.OPENSEA_KEY;
  if (!key) throw new Error("OPENSEA_KEY is not set");
  const traits = JSON.stringify([{ traitType: "Season", value: season }, { traitType: "Collection", value: coll }]);
  const out = [];
  let next = null, page = 0, retries = 0;
  while (page < 5000) {
    const url = new URL(`https://api.opensea.io/api/v2/collection/${OPENSEA_SLUG}/nfts`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("traits", traits);
    if (next) url.searchParams.set("next", next);
    let r;
    try { r = await fetch(url, { headers: { "X-API-KEY": key, accept: "application/json" } }); }
    catch (e) { if (retries++ < 5) { await sleep(2000 * retries); continue; } throw e; }
    if (r.status === 429) { await sleep(3000); continue; }
    if (r.status >= 500 && retries < 5) { retries++; await sleep(2000 * retries); continue; }
    if (!r.ok) throw new Error(`OpenSea ${r.status} on ${coll}: ${(await r.text()).slice(0, 300)}`);
    retries = 0;
    const j = await r.json();
    const pre = (season + " ").toLowerCase(), suf = (" " + coll).toLowerCase();
    for (const n of j.nfts || []) {
      // "Cream02 ChaeWon 372Z #12345" → member "ChaeWon"
      const base = (n.name || "").replace(/\s*#\d+$/, "").trim();
      const lb = base.toLowerCase();
      if (!lb.startsWith(pre) || !lb.endsWith(suf)) continue;
      out.push({ id: String(n.identifier), member: base.slice(pre.length, base.length - suf.length).trim() || "Unknown" });
    }
    next = j.next || null; page++;
    if (page % 20 === 0) log(`  ${coll}: ${out.length} copies so far…`);
    if (!next) break;
    await sleep(300);
  }
  return out;
}

/* ===== Step 2a: who each copy was minted to (= bought by). Never changes, so cached in state. ===== */
export async function lookupMints(ids, cache, save = async () => {}) {
  const todo = ids.filter(id => !cache[id]);
  log(`Mints: ${ids.length - todo.length} cached, ${todo.length} to look up`);
  let size = 100, chunks = 0;
  for (let i = 0; i < todo.length; ) {
    if (outOfTime()) { log(`  Time budget reached after ${i}/${todo.length} mints — saving; next run continues`); break; }
    if (++chunks % 20 === 0) await save();
    const chunk = todo.slice(i, i + size);
    try {
      const logs = await rpc("eth_getLogs", [{ address: CONTRACT, fromBlock: "0x0", toBlock: "latest",
        topics: [TRANSFER, ZERO32, null, chunk.map(topicOf)] }]);
      for (const l of logs) cache[BigInt(l.topics[3]).toString()] = "0x" + l.topics[2].slice(26);
      i += chunk.length;
      if ((i / chunk.length) % 20 === 0) log(`  mints ${i}/${todo.length}`);
    } catch (e) {
      if (size > 5) { size = Math.max(5, Math.floor(size / 2)); log(`  getLogs refused (${e.message}); group size → ${size}`); continue; }
      log(`  giving up on ${chunk.length} ids: ${e.message}`); i += chunk.length;
    }
  }
  return cache;
}

/* ===== Step 2b: who holds each copy now (Multicall3 if available, else JSON-RPC batches) ===== */
export function encAggregate3(target, ids) {
  const n = ids.length, t = target.slice(2).toLowerCase();
  const offsets = [], tuples = [];
  let cur = n * 32;
  for (const id of ids) {
    const data = "6352211e" + pad64(BigInt(id).toString(16)) + "0".repeat(56);
    const tuple = pad64(t) + pad64("1") + pad64("60") + pad64((36).toString(16)) + data;
    offsets.push(pad64(cur.toString(16))); cur += tuple.length / 2; tuples.push(tuple);
  }
  return "0x82ad56cb" + pad64("20") + pad64(n.toString(16)) + offsets.join("") + tuples.join("");
}
export function decAggregate3(result) {
  const h = result.slice(2), at = b => Number(BigInt("0x" + h.slice(b * 2, b * 2 + 64)));
  const arr = at(0), n = at(arr), base = arr + 32, out = [];
  for (let i = 0; i < n; i++) {
    const tOff = base + at(base + 32 * i);
    const ok = at(tOff) === 1, bOff = tOff + at(tOff + 32), len = at(bOff);
    const data = h.slice((bOff + 32) * 2, (bOff + 32 + len) * 2);
    out.push(ok && data.length >= 64 ? "0x" + data.slice(24, 64) : null);
  }
  return out;
}
const ownerOfData = id => "0x6352211e" + pad64(BigInt(id).toString(16));

async function findMulticall(sampleId) {
  let direct;
  try { direct = (await rpc("eth_call", [{ to: CONTRACT, data: ownerOfData(sampleId) }, "latest"])).slice(-40); } catch { return null; }
  for (const addr of MULTICALL_CANDIDATES) {
    try {
      const code = await rpc("eth_getCode", [addr, "latest"]);
      if (!code || code === "0x") continue;
      const got = decAggregate3(await rpc("eth_call", [{ to: addr, data: encAggregate3(CONTRACT, [sampleId]) }, "latest"]));
      if (got[0] && got[0].slice(-40).toLowerCase() === direct.toLowerCase()) return addr;
    } catch {}
  }
  return null;
}

export async function lookupOwners(ids) {
  const res = {};
  res.complete = false;
  if (!ids.length) { res.complete = true; return res; }
  const mc = await findMulticall(ids[0]);
  log(`Holders: ${ids.length} copies via ${mc ? "Multicall3 " + mc : "one-by-one calls"}`);
  let size = mc ? 200 : 1;
  for (let i = 0; i < ids.length; ) {
    if (outOfTime()) { log(`  Time budget reached after ${i}/${ids.length} holders — keeping previous holder standings`); return res; }
    const chunk = ids.slice(i, i + size);
    try {
      if (mc) {
        const owners = decAggregate3(await rpc("eth_call", [{ to: mc, data: encAggregate3(CONTRACT, chunk) }, "latest"]));
        chunk.forEach((id, k) => { if (owners[k]) res[id] = owners[k]; });
      } else {
        const r = await rpc("eth_call", [{ to: CONTRACT, data: ownerOfData(chunk[0]) }, "latest"]);
        if (r && r.length >= 66) res[chunk[0]] = "0x" + r.slice(-40);
      }
      i += chunk.length;
    } catch (e) {
      if (mc && size > 25) { size = Math.floor(size / 2); continue; }
      i += chunk.length; // burned token or persistent error: skip
    }
    if (i % 2000 < size) log(`  holders ${i}/${ids.length}`);
  }
  res.complete = true;
  return res;
}

/* ===== Step 3: rank wallets per member ===== */
export function rank(copiesByColl, walletOf, colls, top) {
  const tally = {};
  let counted = 0;
  for (const coll of colls) for (const c of copiesByColl[coll] || []) {
    const w = walletOf[c.id];
    if (!w) continue;
    counted++;
    const m = (tally[c.member] ||= {});
    const e = (m[w] ||= { total: 0, per: Object.fromEntries(colls.map(x => [x, 0])) });
    e.total++; e.per[coll]++;
  }
  const out = {};
  for (const [member, wallets] of Object.entries(tally)) {
    const list = Object.entries(wallets).sort((a, b) => b[1].total - a[1].total);
    out[member] = { wallets: list.length, top: list.slice(0, top).map(([w, e]) => [w, ...colls.map(c => e.per[c]), e.total]) };
  }
  return { counted, members: out };
}

/* ===== Main ===== */
async function readJSON(file, fallback) { try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; } }

// contest-config.json (set from the website's Contest tab as admin) overrides the defaults above
async function contestConfig() {
  const file = await readJSON(process.env.CONTEST_CONFIG || "contest-config.json", null);
  const c = { ...CONFIG };
  if (file?.season && Array.isArray(file.collections) && file.collections.length) {
    c.season = String(file.season).trim();
    c.collections = file.collections.map(x => String(x).trim().toUpperCase()).filter(Boolean);
  }
  return c;
}

export async function main() {
  const { season, collections: colls, topPerMember, checkHolders } = await contestConfig();
  const t0 = Date.now();
  log(`Contest: ${season} ${colls.join(" + ")} · time budget ${BUDGET_MS / 60000} min`);
  await mkdir(OUT_FILE.replace(/\/[^/]+$/, "") || ".", { recursive: true });

  const state = await readJSON(STATE_FILE, {});
  const prev = await readJSON(OUT_FILE, null);
  if (state.season !== season || JSON.stringify(state.collections) !== JSON.stringify(colls)) {
    state.season = season; state.collections = colls; state.copies = {}; // contest changed: start fresh (keep mint cache)
  }
  state.mints ||= {};
  const saveState = async () => { await writeFile(STATE_FILE, JSON.stringify(state)); };

  // Prefer the crawled COSMO metadata (no OpenSea needed). Use it once the crawl has covered this season.
  let local = null;
  try {
    const all = await loadAll();
    const want = new Set(colls.map(c => c.toLowerCase()));
    const found = {};
    all.collections.forEach((c, i) => {
      if (c[1].toLowerCase() === season.toLowerCase() && want.has(c[3].toLowerCase()))
        for (const id of all.ids[i]) (found[c[3]] ||= []).push({ id: String(id), member: c[2] });
    });
    const latest = all.state.latest || 0;
    const caughtUp = !latest || all.state.next > latest;
    if (Object.keys(found).length && (caughtUp || !process.env.OPENSEA_KEY)) {
      local = found;
      if (!caughtUp) log(`Crawl hasn't caught up yet (#${all.state.next} of #${latest}) and there's no OpenSea key — using what's crawled so far`);
    } else if (Object.keys(found).length) log(`Crawl hasn't caught up yet (#${all.state.next} of #${latest}) — using OpenSea for the full list`);
  } catch {}

  for (const coll of colls) {
    if (local) {
      const key = Object.keys(local).find(k => k.toLowerCase() === coll.toLowerCase());
      state.copies[coll] = key ? local[key] : [];
      log(`${season} ${coll}: ${state.copies[coll].length} copies (from crawled metadata)`);
      continue;
    }
    try {
      const list = await listCopies(season, coll);
      state.copies[coll] = list;
      log(`${season} ${coll}: ${list.length} copies`);
    } catch (e) {
      if (!state.copies[coll]) throw e;
      log(`${coll}: OpenSea failed (${e.message}); reusing last run's list of ${state.copies[coll].length}`);
    }
  }
  await saveState();
  const ids = [...new Set(colls.flatMap(c => (state.copies[c] || []).map(x => x.id)))];

  // Buyers first (the contest's main ranking). Progress is saved as we go.
  try { await lookupMints(ids, state.mints, saveState); }
  finally { await saveState(); }
  const mintsDone = ids.filter(id => state.mints[id]).length;
  const buyers = rank(state.copies, state.mints, colls, topPerMember);

  // Holders only if there's time left; otherwise keep the last complete holder standings.
  let owner = null;
  if (checkHolders && !outOfTime(10 * 60_000)) {
    const owners = await lookupOwners(ids);
    if (owners.complete) owner = { label: "Who holds it now", updated: new Date().toISOString(), ...rank(state.copies, owners, colls, topPerMember) };
  } else if (checkHolders) log("Skipping holders this run (not enough time left)");
  if (!owner && prev?.modes?.owner && prev.season === season &&
      JSON.stringify(prev.collections) === JSON.stringify(colls)) {
    owner = { ...prev.modes.owner, updated: prev.modes.owner.updated || prev.updated };
    log(`Keeping holder standings from ${owner.updated}`);
  }

  const result = {
    updated: new Date().toISOString(),
    season, collections: colls,
    copies: ids.length,
    perCollection: Object.fromEntries(colls.map(c => [c, (state.copies[c] || []).length])),
    progress: { mintsChecked: mintsDone, total: ids.length, complete: mintsDone >= ids.length },
    modes: {
      mint: { label: "Who it was minted to (buyer)", updated: new Date().toISOString(), ...buyers },
      ...(owner ? { owner } : {}),
    },
    tookSeconds: Math.round((Date.now() - t0) / 1000),
  };

  await writeFile(OUT_FILE, JSON.stringify(result));
  log(`Done in ${result.tookSeconds}s · ${ids.length} copies · buyers checked ${mintsDone}/${ids.length}` +
      (owner ? ` · holders as of ${owner.updated}` : "") + ` → ${OUT_FILE}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
