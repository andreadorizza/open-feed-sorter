/** RFC 4180 CSV. */

import { toTable } from "./columns.js";

function escapeCell(value) {
  if (value == null) return "";
  const text = String(value);
  // Quote when the value carries a delimiter, a quote or a newline. A leading
  // or trailing space is also quoted so it survives a round trip.
  if (/[",\r\n]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(items) {
  const { headers, rows } = toTable(items);
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  // CRLF per the spec, and a BOM so Excel opens UTF-8 captions correctly
  // instead of mangling every emoji in them.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
