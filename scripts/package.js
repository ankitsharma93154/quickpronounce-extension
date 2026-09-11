#!/usr/bin/env node
/*
 * Packs the loadable extension into dist/quickpronounce-extension-<version>.zip
 * for Chrome Web Store / Edge Add-ons submission. Stdlib only (zlib): a small
 * ZIP writer, deflate compression.
 *
 *   node scripts/package.js
 *
 * Included: manifest.json, src/, icons/*.png. Everything else (scripts/, docs,
 * store-listing/, .git, node_modules) is left out.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, `quickpronounce-extension-${manifest.version}.zip`);

const INCLUDE_FILES = ["manifest.json"];
const INCLUDE_DIRS = ["src"];
const ICON_FILES = ["icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png"];

function collect() {
  const files = [];
  for (const f of INCLUDE_FILES) files.push(f);
  for (const f of ICON_FILES) {
    if (!fs.existsSync(path.join(ROOT, f))) {
      throw new Error(`${f} is missing - run: node scripts/generate-icons.js`);
    }
    files.push(f);
  }
  for (const d of INCLUDE_DIRS) walk(path.join(ROOT, d), files);
  return files.sort();
}

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(path.relative(ROOT, full).split(path.sep).join("/"));
  }
}

// --- CRC32 -------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// --- ZIP writer ------------------------------------------------------
function dosTime(d) {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, date };
}

function build(files) {
  const now = dosTime(new Date());
  const local = [];
  const central = [];
  let offset = 0;

  for (const name of files) {
    const data = fs.readFileSync(path.join(ROOT, name));
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const nameBuf = Buffer.from(name, "utf8");

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(8, 8); // deflate
    lfh.writeUInt16LE(now.time, 10);
    lfh.writeUInt16LE(now.date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    local.push(lfh, nameBuf, compressed);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt16LE(now.time, 12);
    cdh.writeUInt16LE(now.date, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(offset, 42);
    central.push(cdh, nameBuf);

    offset += lfh.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const localBuf = Buffer.concat(local);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

const files = collect();
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, build(files));
console.log(`packed ${files.length} files -> ${path.relative(ROOT, OUT)}`);
