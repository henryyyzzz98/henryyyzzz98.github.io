// Builds the website folder that GitHub Pages publishes (run by GitHub Actions after the crawl).
//
// Copies your repo's site files into _site/, then adds the generated Objekt lists:
//   _site/objekts/index.json        — every collection: key, artist, season, member, collection, class, color, image, copies
//   _site/objekts/c/<key>.json      — every token ID of one collection, e.g. triples-atom01-jiwoo-100z.json
//                                    (+ "segs" for physical A collections, used to estimate printed serials)
// These generated files are published but never committed, so they don't bloat your repo.

import { cp, mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadAll, collectionKey } from "./crawl-meta.mjs";

const OUT = process.env.SITE_DIR || "_site";
// Repo folders/files that are not part of the website
const SKIP = new Set([".git", ".github", "scripts", "node_modules", "_site", "data/meta", "data/contest-state.json", "data/nicks/state.json"]);

async function copySite(src = ".", rel = "") {
  for (const e of await readdir(src, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (SKIP.has(r)) continue;
    if (e.isDirectory()) { await mkdir(`${OUT}/${r}`, { recursive: true }); await copySite(`${src}/${e.name}`, r); }
    else await cp(`${src}/${e.name}`, `${OUT}/${r}`);
  }
}

/* Physical (A) objekts get token IDs reserved per print run, in blocks, before anyone scans them.
   Inside one unbroken block, (token ID − serial) is constant. A block ends where another collection's
   token sits in between. For each block we record where it starts in the sorted ID list and the nearest
   other-collection token before it; the page turns that into serials (and applies admin corrections).
   → [[startIndex, previousOtherToken | null], …] */
export function physicalSegments(sortedIds, me, owner) {
  const segs = [];
  const foreign = id => id < owner.length && owner[id] !== 0 && owner[id] !== me;
  for (let k = 0; k < sortedIds.length; k++) {
    const id = sortedIds[k];
    let newSeg = k === 0;
    if (!newSeg) {
      const prev = sortedIds[k - 1];
      for (let j = prev + 1; j < id; j++) if (foreign(j)) { newSeg = true; break; }
    }
    if (newSeg) {
      let pf = null;
      for (let j = id - 1; j >= Math.max(0, id - 1000); j--) if (foreign(j)) { pf = j; break; }
      segs.push([k, pf]);
    }
  }
  return segs;
}

export async function build() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(`${OUT}/objekts/c`, { recursive: true });
  await copySite();

  const { collections, ids, state, owner } = await loadAll();
  const index = [];
  for (let i = 0; i < collections.length; i++) {
    const [artist, season, member, coll, cls, color, image] = collections[i];
    const key = collectionKey(artist, season, member, coll);
    index.push({ key, artist, season, member, coll, cls, color, image, copies: ids[i].length });
    const out = { key, artist, season, member, coll, cls, color, image, ids: ids[i] };
    if (/A$/i.test(coll)) out.segs = physicalSegments(ids[i], i + 1, owner);
    await writeFile(`${OUT}/objekts/c/${key}.json`, JSON.stringify(out));
  }
  await writeFile(`${OUT}/objekts/index.json`, JSON.stringify({
    updated: new Date().toISOString(),
    crawledUpTo: state.next - 1,
    latest: state.latest || null,
    collections: index,
  }));
  // tells GitHub Pages not to run Jekyll (faster, and keeps every file as-is)
  await writeFile(`${OUT}/.nojekyll`, "");
  const total = index.reduce((s, c) => s + c.copies, 0);
  console.log(`Built ${OUT}/ · ${index.length} collections · ${total.toLocaleString()} copies · crawled up to #${(state.next - 1).toLocaleString()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build().catch(e => { console.error(e); process.exit(1); });
}
