import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, makeZip } from "../src/core/zip.js";
import { toXlsx, columnName, safeSheetName } from "../src/core/export/xlsx.js";

/** Blob exists in Node 18+, so the browser code runs here unmodified. */
async function bytes(blob) {
  return Buffer.from(await blob.arrayBuffer());
}

test("crc32 matches the known IEEE check value", () => {
  // The standard test vector: CRC-32 of "123456789" is 0xCBF43926.
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("a built zip is readable by the system unzip", async () => {
  const blob = makeZip([
    { name: "hello.txt", data: "hello world" },
    { name: "nested/data.json", data: JSON.stringify({ ok: true }) },
    { name: "bytes.bin", data: new Uint8Array([0, 1, 2, 250, 255]) },
  ]);

  const dir = mkdtempSync(join(tmpdir(), "sfb-zip-"));
  const path = join(dir, "test.zip");
  writeFileSync(path, await bytes(blob));

  // -t verifies every entry's CRC against its stored data.
  const output = execFileSync("unzip", ["-t", path], { encoding: "utf8" });
  assert.match(output, /No errors detected/);

  execFileSync("unzip", ["-o", "-q", path, "-d", dir]);
  assert.equal(readFileSync(join(dir, "hello.txt"), "utf8"), "hello world");
  assert.equal(readFileSync(join(dir, "nested/data.json"), "utf8"), '{"ok":true}');
  assert.deepEqual([...readFileSync(join(dir, "bytes.bin"))], [0, 1, 2, 250, 255]);
});

test("non-ASCII filenames are stored as flagged UTF-8", async () => {
  // Asserted against the bytes in the local file header rather than against
  // `unzip -l` output: how a CLI *renders* a non-ASCII name depends on the
  // build and the locale, so grepping its output tests the runner, not the
  // zip. What matters is the format guarantee — the name is UTF-8 and bit 11
  // of the general-purpose flags says so, without which extractors fall back
  // to CP437 and mangle it.
  const name = "café–reels.csv";
  const buf = await bytes(makeZip([{ name, data: "a,b\n1,2\n" }]));

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50, "local file header signature");

  const flags = view.getUint16(6, true);
  assert.equal(flags & 0x0800, 0x0800, "UTF-8 name flag (bit 11) must be set");

  const nameLength = view.getUint16(26, true);
  const encoded = new TextEncoder().encode(name);
  assert.equal(nameLength, encoded.length, "length is in bytes, not characters");
  assert.equal(new TextDecoder("utf-8").decode(buf.subarray(30, 30 + nameLength)), name);

  // And the archive as a whole still passes an integrity check. `-t` reports
  // CRCs, not filenames, so it says the same thing in every locale.
  const dir = mkdtempSync(join(tmpdir(), "sfb-zip-utf8-"));
  const path = join(dir, "u.zip");
  writeFileSync(path, buf);
  assert.match(execFileSync("unzip", ["-t", path], { encoding: "utf8" }), /No errors detected/);
});

test("column names roll over past Z", () => {
  assert.equal(columnName(0), "A");
  assert.equal(columnName(25), "Z");
  assert.equal(columnName(26), "AA");
  assert.equal(columnName(27), "AB");
  assert.equal(columnName(51), "AZ");
  assert.equal(columnName(52), "BA");
});

test("sheet names are trimmed to what Excel accepts", () => {
  assert.equal(safeSheetName("a/b:c*d?e[f]g"), "a b c d e f g");
  assert.equal(safeSheetName(""), "Sheet1");
  assert.equal(safeSheetName("x".repeat(40)).length, 31);
});

test("an xlsx export is a valid OOXML package", async () => {
  const items = [
    {
      author: "someone",
      url: "https://example.com/p/abc/",
      createdAtMs: Date.UTC(2026, 0, 2, 3, 4, 5),
      views: 1234,
      likes: 56,
      comments: 7,
      outlierScore: 3.5,
      caption: 'Quotes " & <angles> and a 😀',
    },
  ];

  const dir = mkdtempSync(join(tmpdir(), "sfb-xlsx-"));
  const path = join(dir, "out.xlsx");
  writeFileSync(path, await bytes(toXlsx(items, { sheetName: "someone" })));

  assert.match(execFileSync("unzip", ["-t", path], { encoding: "utf8" }), /No errors detected/);

  const names = execFileSync("unzip", ["-l", path], { encoding: "utf8" });
  for (const part of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
  ]) {
    assert.ok(names.includes(part), `missing part: ${part}`);
  }

  const sheet = execFileSync("unzip", ["-p", path, "xl/worksheets/sheet1.xml"], {
    encoding: "utf8",
  });
  // Header row bold, data starts at row 2, numbers stay numeric.
  assert.match(sheet, /<row r="1">/);
  assert.match(sheet, /<t xml:space="preserve">Views<\/t>/);
  assert.match(sheet, /<row r="2">/);
  assert.match(sheet, /<v>1234<\/v>/);
  // XML metacharacters in the caption must be escaped, not emitted raw.
  assert.match(sheet, /Quotes &quot; &amp; &lt;angles&gt;/);
  assert.ok(!/<angles>/.test(sheet));
});

test("xlsx omits columns no item carries", async () => {
  // Instagram photos have no view count, so a Posts export should have no
  // Views column at all rather than a column of blanks.
  const items = [{ author: "a", url: "u", createdAtMs: 0, likes: 3, caption: "c" }];
  const dir = mkdtempSync(join(tmpdir(), "sfb-xlsx-cols-"));
  const path = join(dir, "o.xlsx");
  writeFileSync(path, await bytes(toXlsx(items)));
  const sheet = execFileSync("unzip", ["-p", path, "xl/worksheets/sheet1.xml"], {
    encoding: "utf8",
  });
  assert.ok(sheet.includes(">Likes<"));
  assert.ok(!sheet.includes(">Views<"));
});
