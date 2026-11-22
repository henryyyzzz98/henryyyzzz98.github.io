// Objekt metadata crawler — run by GitHub Actions every hour (or locally: `node scripts/crawl-meta.mjs`).
//
// Walks token IDs upward from 1 and asks COSMO what each one is (season, member, collection…):
//   https://api.cosmo.fans/bff/v3/objekts/nft-metadata/<tokenId>
// It picks up where the previous run stopped, so the first full crawl is spread over many runs,
// and after that each run only checks the newly minted tokens.
//
// Saved in the repo (small, and never rewritten once complete):
//   data/meta/collections.json  — every collection seen: [artist, season, member, collection, class, color, image]
//   data/meta/chunks/<n>.json   — token IDs n*10000 … n*10000+9999 → collection number (index+1; 0 = unknown)
//   data/meta/state.json        — where to continue next time
//
// Needs Node 18+ (built-in fetch). No npm packages.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const META_URL = "https://api.cosmo.fans/bff/v3/objekts/nft-metadata/";
const CONTRACT = "0x99bb83ae9bb0c0a6be865cacf67760947f91cb70";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO32 = "0x" + "0".repeat(64);
const RPCS = (process.env.RPC_URLS || "https://api.mainnet.abs.xyz,https://abstract.api.onfinality.io/public").split(",");

export const DIR = process.env.META_DIR || "data/meta";
export const CHUNK = 10_000;

// Be polite to COSMO's server: this many requests per second at most, a few at a time.
const RPS = Number(process.env.COSMO_RPS || 20);
const PARALLEL = Number(process.env.COSMO_PARALLEL || 8);
const BUDGET_MS = Number(process.env.TIME_BUDGET_MIN || 35) * 60_000;
const BATCH = 500;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function readJSON(file, fallback) { try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; } }

export const collectionKey = (artist, season, member, coll) =>
  `${artist}-${season}-${member}-${coll}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

/* ---------- the newest token ID, from recent mints on the chain ---------- */
async function rpc(method, params) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(RPCS[attempt % RPCS.length], { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(30_000) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { if (attempt === 3) throw e; await sleep(1500 * (attempt + 1)); }
  }
}
export async function latestTokenId() {
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  for (const span of [2_000, 20_000, 200_000]) {
    try {
      const logs = await rpc("eth_getLogs", [{ address: CONTRACT, topics: [TRANSFER, ZERO32],
        fromBlock: "0x" + Math.max(0, head - span).toString(16), toBlock: "0x" + head.toString(16) }]);
      if (logs.length) return logs.reduce((m, l) => Math.max(m, Number(BigInt(l.topics[3]))), 0);
    } catch (e) { log(`  getLogs over ${span} blocks failed: ${e.message}`); }
  }
  return null;
}

/* ---------- one token's metadata ---------- */
// → { artist, season, member, coll, cls, color, image } | null (not found) ; throws on temporary errors
export async function fetchMeta(id) {
  const r = await fetch(META_URL + id, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  const m = await r.json();
  const a = k => (m.attributes || []).find(x => x.trait_type === k)?.value;
  const season = a("Season"), member = a("Member"), coll = a("Collection");
  if (!season || !member || !coll) return null;
  return { artist: a("Artist") || "", season, member, coll, cls: a("Class") || "", color: m.background_color || "", image: m.image || "" };
}

/* ---------- rate-limited pool ---------- */
let nextSlot = 0;
async function slot() { // spaces requests so we never exceed RPS
  const now = Date.now(), at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / RPS;
  if (at > now) await sleep(at - now);
}
async function fetchWithRetry(id) {
  for (let attempt = 0; ; attempt++) {
    await slot();
    try { return await fetchMeta(id); }
    catch (e) {
      if (attempt >= 5) return undefined; // give up for this run; retried next run
      const wait = e.status === 429 ? 10_000 * (attempt + 1) : 2_000 * (attempt + 1);
      if (e.status === 429) log(`  COSMO says slow down (429) — waiting ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}
async function runBatch(ids) {
  const out = new Array(ids.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, ids.length) }, async () => {
    while (i < ids.length) { const k = i++; out[k] = await fetchWithRetry(ids[k]); }
  }));
  return out;
}

/* ---------- main ---------- */
export async function crawl() {
  const t0 = Date.now(), deadline = t0 + BUDGET_MS;
  await mkdir(`${DIR}/chunks`, { recursive: true });
  const state = await readJSON(`${DIR}/state.json`, { next: 1 });
  const collections = await readJSON(`${DIR}/collections.json`, []);
  const index = new Map(collections.map((c, i) => [collectionKey(c[0], c[1], c[2], c[3]), i + 1]));
  const chunks = new Map(); // n → array, loaded lazily
  const dirty = new Set();
  let newCollections = 0;

  const chunkOf = async n => {
    if (!chunks.has(n)) chunks.set(n, await readJSON(`${DIR}/chunks/${n}.json`, new Array(CHUNK).fill(0)));
    return chunks.get(n);
  };
  const save = async () => {
    for (const n of dirty) await writeFile(`${DIR}/chunks/${n}.json`, JSON.stringify(chunks.get(n)));
    dirty.clear();
    // keep only the chunk we're still filling in memory
    for (const n of [...chunks.keys()]) if (n !== Math.floor(state.next / CHUNK)) chunks.delete(n);
    await writeFile(`${DIR}/collections.json`, JSON.stringify(collections));
    await writeFile(`${DIR}/state.json`, JSON.stringify(state, null, 1));
  };

  let target = null;
  try { target = await latestTokenId(); } catch (e) { log(`Couldn't read the newest token from the chain: ${e.message}`); }
  log(`Crawl from #${state.next.toLocaleString()} to ${target ? "#" + target.toLocaleString() : "(unknown end — will stop at a run of missing tokens)"} · ${RPS}/s`);
  if (target && state.next > target) { log("Already up to date."); state.latest = target; await save(); return { done: 0, upToDate: true }; }

  let done = 0, missStreak = 0, lastLog = Date.now();
  while (Date.now() < deadline) {
    const end = target ? Math.min(target, state.next + BATCH - 1) : state.next + BATCH - 1;
    if (end < state.next) break;
    const ids = Array.from({ length: end - state.next + 1 }, (_, k) => state.next + k);
    const metas = await runBatch(ids);

    // stop at the first temporary failure, or at missing tokens right at the newest end (COSMO may not have them yet)
    // A missing token with newer tokens after it is a real gap (skip it). One at the very end may just not be
    // published by COSMO yet, so we stop there and try again next run.
    let lastFound = -1;
    for (let k = ids.length - 1; k >= 0; k--) if (metas[k]) { lastFound = k; break; }
    let stopAt = ids.length;
    for (let k = 0; k < ids.length; k++) {
      if (metas[k] === undefined) { stopAt = k; break; }
      if (metas[k] === null && target && ids[k] > target - 500 && k > lastFound) { stopAt = k; break; }
    }
    for (let k = 0; k < stopAt; k++) {
      const id = ids[k], m = metas[k];
      let v = 0;
      if (m) {
        const key = collectionKey(m.artist, m.season, m.member, m.coll);
        v = index.get(key);
        if (!v) { collections.push([m.artist, m.season, m.member, m.coll, m.cls, m.color, m.image]); v = collections.length; index.set(key, v); newCollections++; }
        missStreak = 0;
      } else missStreak++;
      const n = Math.floor(id / CHUNK);
      (await chunkOf(n))[id % CHUNK] = v;
      dirty.add(n);
    }
    state.next = ids[stopAt - 1] !== undefined ? ids[stopAt - 1] + 1 : state.next;
    done += stopAt;

    if (!target && missStreak >= 2000) { state.next -= missStreak; log("Reached a long run of missing tokens — treating that as the end."); break; }
    if (stopAt < ids.length) { log(`Stopped at #${ids[stopAt].toLocaleString()} (not available yet) — next run continues there.`); break; }
    if (target && state.next > target) break;
    if (dirty.size && (done / BATCH) % 10 === 0) await save();
    if (Date.now() - lastLog > 60_000) {
      const rate = done / ((Date.now() - t0) / 1000);
      log(`  at #${state.next.toLocaleString()} · ${rate.toFixed(1)}/s` + (target ? ` · ${((target - state.next) / rate / 3600).toFixed(1)} h of crawling left` : ""));
      lastLog = Date.now();
    }
  }
  state.latest = target || state.latest || null;
  state.updated = new Date().toISOString();
  await save();
  log(`Checked ${done.toLocaleString()} tokens · ${newCollections} new collections · ${collections.length} total · next run starts at #${state.next.toLocaleString()}`);
  return { done, newCollections };
}

/* ---------- helpers for other scripts: read everything back ---------- */
export async function loadAll(dir = DIR) {
  const collections = await readJSON(`${dir}/collections.json`, []);
  const state = await readJSON(`${dir}/state.json`, { next: 1 });
  const lastChunk = Math.floor(Math.max(1, state.next - 1) / CHUNK);
  const ids = collections.map(() => []);     // collection index → token IDs
  const owner = new Uint32Array((lastChunk + 1) * CHUNK); // token ID → collection number (index+1), 0 = unknown
  for (let n = 0; n <= lastChunk; n++) {
    const arr = await readJSON(`${dir}/chunks/${n}.json`, null);
    if (!arr) continue;
    for (let k = 0; k < arr.length; k++) if (arr[k]) { ids[arr[k] - 1].push(n * CHUNK + k); owner[n * CHUNK + k] = arr[k]; }
  }
  return { collections, ids, state, owner };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  crawl().catch(e => { console.error(e); process.exit(1); });
}
