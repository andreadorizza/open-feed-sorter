import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { crc32 } from "../src/core/zip.js";
import { zipDirectory } from "../scripts/package.mjs";

/**
 * The store zip is read from its own bytes, never by listing it with `unzip`:
 * how a CLI prints entry names depends on its build and locale. The central
 * directory is the archive's table of contents, so it is what the store's
 * unpacker reads too. PKWARE APPNOTE.TXT 4.3.12 and 4.3.16.
 */
function readCentralDirectory(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // The end-of-central-directory record is the last thing in the file,
  // followed only by an optional comment — so scan back for its signature.
  let eocd = buf.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  assert.ok(eocd >= 0, "end of central directory record not found");

  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const entries = [];

  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50, `central header ${i} signature`);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    entries.push({
      name: new TextDecoder().decode(buf.subarray(at + 46, at + 46 + nameLength)),
      crc: view.getUint32(at + 16, true),
      size: view.getUint32(at + 20, true),
      localOffset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** An entry's stored bytes, found through its local file header (APPNOTE 4.3.7). */
function readEntryData(buf, entry) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const at = entry.localOffset;
  assert.equal(view.getUint32(at, true), 0x04034b50, `${entry.name}: local header signature`);
  assert.equal(view.getUint16(at + 8, true), 0, `${entry.name}: stored, not compressed`);
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  return buf.subarray(start, start + entry.size);
}

const FILES = {
  "manifest.json": '{"manifest_version":3}',
  "popup/popup.html": "<!doctype html>",
  "icons/icon-16.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]),
  // Everything below is the kind of thing a file manager or an editor leaves
  // in a folder, and none of it should reach the store.
  ".DS_Store": "finder",
  "icons/.DS_Store": "finder",
  ".git/HEAD": "ref: refs/heads/main",
};

/** A dist/ folder inside a fresh temp directory, so a stray prefix would show. */
async function packageFixture() {
  const dist = join(mkdtempSync(join(tmpdir(), "ofs-package-")), "dist");
  for (const [name, data] of Object.entries(FILES)) {
    mkdirSync(dirname(join(dist, name)), { recursive: true });
    writeFileSync(join(dist, name), data);
  }
  const { zip, names } = await zipDirectory(dist);
  return { buf: Buffer.from(await zip.arrayBuffer()), names };
}

test("a package has manifest.json at its root, with no folder above it", async () => {
  const { buf, names } = await packageFixture();
  const entries = readCentralDirectory(buf).map((entry) => entry.name);

  assert.deepEqual(entries, ["icons/icon-16.png", "manifest.json", "popup/popup.html"]);
  assert.deepEqual(names, entries, "the names reported match the archive's own");

  for (const name of entries) {
    assert.ok(!name.startsWith("dist/"), `${name} is nested under dist/`);
    assert.ok(!name.startsWith("/"), `${name} is an absolute path`);
    assert.ok(!name.includes("\\"), `${name} uses a Windows separator`);
    assert.ok(!name.endsWith("/"), `${name} is a directory entry`);
  }
});

test("dotfiles and dot-folders are left out of a package", async () => {
  const { buf } = await packageFixture();
  for (const { name } of readCentralDirectory(buf)) {
    assert.ok(
      !name.split("/").some((part) => part.startsWith(".")),
      `${name} should not be packaged`,
    );
  }
});

test("every packaged file's bytes and CRC survive the round trip", async () => {
  const { buf } = await packageFixture();
  for (const entry of readCentralDirectory(buf)) {
    const expected = FILES[entry.name];
    const expectedBytes =
      typeof expected === "string" ? new TextEncoder().encode(expected) : expected;
    const stored = readEntryData(buf, entry);

    assert.deepEqual([...stored], [...expectedBytes], `${entry.name}: contents`);
    assert.equal(entry.crc, crc32(stored), `${entry.name}: CRC`);
  }
});
