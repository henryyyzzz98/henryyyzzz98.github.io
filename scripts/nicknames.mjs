// Saves COSMO nicknames for Objekt wallets — run by GitHub Actions each hour (or locally: `node scripts/nicknames.mjs`).
//
// 1. Collects wallet addresses from Objekt transfers on Abstract: everything new since the last run,
//    plus a slice of older history each run (working backwards until it reaches the start).
// 2. Looks up each wallet's nickname at objekt.top/api/v1/profiles/<address>, gently (a few per second),
//    and re-checks a wallet when it shows up again after 30 days, in case the nickname changed.
// 3. Saves them in data/nicks/<first two hex chars>.json, e.g. data/nicks/a3.json:
//       { "0xa3…": ["HarryPotter", 20412], "0xa3…": ["", 20410] }   // [nickname or "" for none, day checked]
//    Only the files that changed are rewritten, so the repo grows slowly.
//
// Needs Node 18+ (built-in fetch). No npm packages.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CONTRACT = "0x99bb83ae9bb0c0a6be865cacf67760947f91cb70";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const START_BLOCK = 6_363_806;                 // first Objekt block on Abstract (from apollo.cafe's indexer)
const SPIN_WALLET = "0xd3d5f29881ad87bb10c1100e2c709c9596de345f";
const NICK_URL = process.env.NICK_URL || "https://objekt.top/api/v1/profiles/";
const RPCS = (process.env.RPC_URLS || "https://api.mainnet.abs.xyz,https://abstract.api.onfinality.io/public").split(",");
const DIR = process.env.NICK_DIR || "data/nicks";
const BUDGET_MS = Number(process.env.TIME_BUDGET_MIN || 8) * 60_000;
const LOOKUPS_PER_SEC = Number(process.env.NICK_RPS || 3);
const REFRESH_DAYS = 30;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const today = () => Math.floor(Date.now() / 86_400_000);
async function readJSON(file, fallback) { try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; } }

let rpcIdx = 0;
async function rpc(method, params) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(RPCS[rpcIdx], { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(30_000) });
      const j = await r.json();
      if (j.error) { const e = new Error(j.error.message); e.rpc = true; throw e; }
      return j.result;
    } catch (e) {
      if (e.rpc && /range|limit|too many|exceed/i.test(e.message)) throw e;  // caller shrinks the range
      rpcIdx = (rpcIdx + 1) % RPCS.length;
      if (attempt === 3) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}
const hex = n => "0x" + n.toString(16);

// Wallets in Objekt transfers between two blocks; shrinks the range if the RPC refuses
async function walletsIn(from, to, out) {
  let size = Math.max(1, to - from + 1);
  for (let b = from; b <= to; ) {
    const end = Math.min(to, b + size - 1);
    try {
      const logs = await rpc("eth_getLogs", [{ address: CONTRACT, topics: [TRANSFER], fromBlock: hex(b), toBlock: hex(end) }]);
      for (const l of logs) for (const t of [l.topics[1], l.topics[2]]) out.add("0x" + t.slice(26).toLowerCase());
      b = end + 1;
      if (logs.length < 2000 && size < 50_000) size *= 2;
    } catch (e) {
      if (size <= 1) throw e;
      size = Math.max(1, Math.floor(size / 4));
    }
  }
}

export async function fetchNick(addr) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(NICK_URL + addr, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!r) { await sleep(2000); continue; }
    if (r.status === 404) return "";
    if (r.status === 429 || r.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    return j && typeof j.nickname === "string" ? j.nickname.trim() : "";
  }
  return undefined; // try again next run
}

export async function run() {
  const t0 = Date.now(), deadline = t0 + BUDGET_MS;
  await mkdir(DIR, { recursive: true });
  const state = await readJSON(`${DIR}/state.json`, {});
  state.pending ||= [];
  const shards = new Map(), dirty = new Set();
  const shardOf = async a => {
    const k = a.slice(2, 4);
    if (!shards.has(k)) shards.set(k, await readJSON(`${DIR}/${k}.json`, {}));
    return { k, data: shards.get(k) };
  };

  // Wallets we should look up: unknown ones, or ones last checked 30+ days ago
  const queued = new Set(state.pending);
  const enqueue = async addrs => {
    for (const a of addrs) {
      if (a === SPIN_WALLET || /^0x0{40}$/.test(a) || queued.has(a)) continue;
      const { data } = await shardOf(a);
      const e = data[a];
      if (!e || today() - e[1] >= REFRESH_DAYS) { state.pending.push(a); queued.add(a); }
    }
  };

  // 1) wallets in transfers since the last run
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  if (state.forward == null) { state.forward = Math.max(START_BLOCK, head - 20_000); state.backward = state.forward - 1; }
  const fresh = new Set();
  try { await walletsIn(state.forward, head, fresh); state.forward = head + 1; }
  catch (e) { log(`Couldn't read new transfers: ${e.message}`); }
  await enqueue(fresh);
  const newQueued = state.pending.length;

  // 2) older history, but only as much as this run can look up — keeps the waiting list (and state.json) small
  const capacity = Math.floor(BUDGET_MS / 1000 * LOOKUPS_PER_SEC * 0.7);
  const backBudget = t0 + BUDGET_MS * 0.25;
  while (state.backward >= START_BLOCK && state.pending.length < capacity && Date.now() < backBudget) {
    const from = Math.max(START_BLOCK, state.backward - 20_000);
    const older = new Set();
    try { await walletsIn(from, state.backward, older); state.backward = from - 1; }
    catch (e) { log(`Older history paused: ${e.message}`); break; }
    await enqueue(older);
  }
  log(`To look up: ${newQueued} from new transfers, ${state.pending.length - newQueued} from older history` +
      (state.backward >= START_BLOCK ? ` (history left: blocks ${START_BLOCK.toLocaleString()}–${state.backward.toLocaleString()})` : " (history complete)"));

  // 3) look up nicknames until the time runs out
  let looked = 0, named = 0;
  const gap = 1000 / LOOKUPS_PER_SEC;
  while (state.pending.length && Date.now() < deadline) {
    const a = state.pending[0];
    const t = Date.now();
    const nick = await fetchNick(a);
    if (nick === undefined) { state.pending.push(state.pending.shift()); }        // failed: retry later
    else {
      state.pending.shift();
      const { k, data } = await shardOf(a);
      data[a] = [nick, today()]; dirty.add(k);
      looked++; if (nick) named++;
    }
    const wait = gap - (Date.now() - t);
    if (wait > 0) await sleep(wait);
  }

  for (const k of dirty) {
    const data = shards.get(k);
    const sorted = Object.fromEntries(Object.keys(data).sort().map(a => [a, data[a]]));
    await writeFile(`${DIR}/${k}.json`, JSON.stringify(sorted));
  }
  state.updated = new Date().toISOString();
  await writeFile(`${DIR}/state.json`, JSON.stringify(state));
  log(`Looked up ${looked} wallets (${named} have nicknames) · ${state.pending.length} still waiting · ${dirty.size} files updated · ${Math.round((Date.now() - t0) / 1000)}s`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(e => { console.error(e); process.exit(1); });
}
