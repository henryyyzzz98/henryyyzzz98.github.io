// Collects every Objekt that was sent to COSMO's spin wallet on Polygon (before Objekts moved to
// Abstract in April 2025), so the website's Spun / Non-Spin counts include Polygon-era spins.
// Polygon history no longer changes, so this only needs to finish once. It saves its place and can
// be run again to continue (or to top up).
//
// Output (in OUT_DIR, default data/polyspun):
//   <n>.txt   token IDs from n*100000 to n*100000+99999 that were spun: sorted, each written as the
//             gap from the previous ID in base 36, comma-separated (keeps the files small)
//   state.json  { nextBlock, done, logs }
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";

const KEY = process.env.ETHERSCAN_KEY;
const OUT = process.env.OUT_DIR || "data/polyspun";
const BUDGET_MS = Number(process.env.TIME_BUDGET_MIN || 300) * 60_000;
const CONTRACT = "0xa4b37be40f7b231ee9574c4b16b7ddb7eacdc99b";
const SPIN_WALLET = "0xD3D5f29881ad87Bb10C1100e2c709c9596dE345F";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const SPIN_TOPIC = "0x" + SPIN_WALLET.slice(2).toLowerCase().padStart(64, "0");
const CHUNK = 100_000;

if (!KEY) { console.error("Missing ETHERSCAN_KEY"); process.exit(1); }
const started = Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function readJSON(f, fallback) { try { return JSON.parse(await readFile(f, "utf8")); } catch { return fallback; } }

// load what earlier runs found
async function loadIds() {
  const ids = new Set();
  let files = [];
  try { files = await readdir(OUT); } catch {}
  for (const f of files) {
    const m = f.match(/^(\d+)\.txt$/); if (!m) continue;
    let cur = Number(m[1]) * CHUNK;
    const text = (await readFile(`${OUT}/${f}`, "utf8")).trim();
    if (!text) continue;
    for (const d of text.split(",")) { cur += parseInt(d, 36); ids.add(cur); }
  }
  return ids;
}

async function saveIds(ids) {
  await mkdir(OUT, { recursive: true });
  const byChunk = new Map();
  for (const id of [...ids].sort((a, b) => a - b)) {
    const c = Math.floor(id / CHUNK);
    if (!byChunk.has(c)) byChunk.set(c, []);
    byChunk.get(c).push(id);
  }
  for (const [c, list] of byChunk) {
    let prev = c * CHUNK;
    const parts = list.map(id => { const d = id - prev; prev = id; return d.toString(36); });
    await writeFile(`${OUT}/${c}.txt`, parts.join(",") + "\n");
  }
}

async function getLogs(fromBlock) {
  const u = new URL("https://api.etherscan.io/v2/api");
  Object.entries({ chainid: "137", module: "logs", action: "getLogs", address: CONTRACT, fromBlock: String(fromBlock), toBlock: "latest",
    topic0: TRANSFER, topic2: SPIN_TOPIC, topic0_2_opr: "and", page: "1", offset: "1000", apikey: KEY })
    .forEach(([a, b]) => u.searchParams.set(a, b));
  for (let attempt = 0; ; attempt++) {
    try {
      const j = await (await fetch(u)).json();
      if (j.status === "1") return j.result;
      if (/no records/i.test(j.message || "") || (Array.isArray(j.result) && !j.result.length)) return [];
      if (attempt < 6 && /rate limit|timeout|busy|temporar/i.test(String(j.result) + j.message)) { await sleep(1500 * (attempt + 1)); continue; }
      throw new Error(typeof j.result === "string" ? j.result : j.message || "Etherscan error");
    } catch (e) {
      if (attempt >= 6) throw e;
      await sleep(2000 * (attempt + 1));
    }
  }
}

const state = await readJSON(`${OUT}/state.json`, { nextBlock: 0, done: false, logs: 0 });
const ids = await loadIds();
console.log(`Starting at Polygon block ${state.nextBlock}, ${ids.size.toLocaleString()} spun copies found so far.`);

let block = state.nextBlock, seenAtBlock = new Set(), lastSave = Date.now(), calls = 0, failed = null;
state.done = false;
try {
while (Date.now() - started < BUDGET_MS) {
  const logs = await getLogs(block);
  calls++;
  let maxBlock = block;
  for (const l of logs) {
    const b = parseInt(l.blockNumber, 16), key = l.transactionHash + ":" + l.logIndex;
    if (b === block && seenAtBlock.has(key)) continue;   // already counted when this block was the last one of the previous page
    ids.add(Number(BigInt(l.topics[3])));
    state.logs++;
    if (b > maxBlock) { maxBlock = b; seenAtBlock = new Set(); }
    if (b === maxBlock) seenAtBlock.add(key);
  }
  if (logs.length < 1000) { state.done = true; state.nextBlock = maxBlock; break; }
  // the last block may continue on the next page, so start the next page from it (duplicates are skipped above)
  state.nextBlock = block = maxBlock === block ? block + 1 : maxBlock;
  if (Date.now() - lastSave > 5 * 60_000) { await saveIds(ids); await writeFile(`${OUT}/state.json`, JSON.stringify(state)); lastSave = Date.now(); }
  if (calls % 50 === 0) console.log(`  block ${block} · ${ids.size.toLocaleString()} spun copies`);
  await sleep(260);   // free Etherscan keys allow about 5 calls a second
}
} catch (e) { failed = e; console.error("Stopped early:", e.message); }

await saveIds(ids);
state.updated = new Date().toISOString();
await writeFile(`${OUT}/state.json`, JSON.stringify(state));
console.log(`${state.done ? "Finished" : "Paused (time budget)"}: ${ids.size.toLocaleString()} spun copies on Polygon, up to block ${state.nextBlock}.`);
if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `done=${state.done}\n`, { flag: "a" });
if (failed) process.exit(1);   // progress so far is saved; the next run carries on from here
