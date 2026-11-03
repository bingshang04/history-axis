#!/usr/bin/env node
/* Sync the standalone app into the DSH plugin package (ds-plugin/web). */
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "ds-plugin", "web");

async function copyDir(srcRel, destRel) {
  const src = path.join(ROOT, srcRel);
  const dest = path.join(WEB, destRel);
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyDir(path.join(srcRel, entry.name), path.join(destRel, entry.name));
    } else if (entry.isFile()) {
      await cp(from, to);
    }
  }
}

await rm(WEB, { recursive: true, force: true });
for (const dir of ["css", "js", "data"]) {
  await copyDir(dir, dir);
}
await cp(path.join(ROOT, "index.html"), path.join(WEB, "index.html"));
const files = [];
async function walk(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), path.join(prefix, entry.name));
    else files.push(path.join(prefix, entry.name));
  }
}
await walk(WEB);
console.log("synced", files.length, "files into ds-plugin/web");
