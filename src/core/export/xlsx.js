/**
 * A minimal .xlsx writer.
 *
 * An xlsx file is a zip of OOXML parts, and the subset needed for "one sheet
 * of strings and numbers with a bold header row" is small enough to write
 * directly. Doing so replaces a ~1MB spreadsheet library with ~150 lines, which
 * matters for an extension that has to ship its dependencies to every user.
 *
 * Strings are written inline (`t="inlineStr"`) rather than through a shared
 * string table: it costs a little size on repetitive columns and saves a whole
 * part plus the bookkeeping to build it.
 */

import { makeZip } from "../zip.js";
import { toTable } from "./columns.js";

/** 0 → "A", 25 → "Z", 26 → "AA" */
export function columnName(index) {
  let name = "";
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 forbids most control characters outright; strip rather than
    // escape, since no spreadsheet wants a literal 0x07 in a caption.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function cell(ref, value, { bold = false } = {}) {
  if (value == null || value === "") return "";
  const style = bold ? ' s="1"' : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(headers, rows) {
  const parts = [];

  parts.push(
    `<row r="1">` +
      headers.map((h, i) => cell(`${columnName(i)}1`, h, { bold: true })).join("") +
      `</row>`,
  );

  rows.forEach((row, rowIndex) => {
    const r = rowIndex + 2;
    parts.push(
      `<row r="${r}">` +
        row.map((value, i) => cell(`${columnName(i)}${r}`, value)).join("") +
        `</row>`,
    );
  });

  // Give every column a workable default width; URLs and captions are long and
  // a default-width sheet opens as a wall of "####".
  const cols = headers
    .map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${widthFor(h)}" customWidth="1"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${parts.join("")}</sheetData></worksheet>`;
}

function widthFor(header) {
  if (header === "Caption") return 60;
  if (header === "URL") return 46;
  if (header === "Date") return 22;
  return 12;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// Two cell formats: index 0 is the default, index 1 is bold (the header row).
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

/** Excel rejects these characters in a sheet name, and caps it at 31 chars. */
export function safeSheetName(name) {
  const cleaned = String(name || "")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || "Sheet1";
}

/** @returns {Blob} an .xlsx file */
export function toXlsx(items, { sheetName = "Sheet1" } = {}) {
  const { headers, rows } = toTable(items);
  return makeZip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "xl/workbook.xml", data: workbookXml(safeSheetName(sheetName)) },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS },
    { name: "xl/styles.xml", data: STYLES },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(headers, rows) },
  ]);
}
