export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = source.length;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < n) {
    const char = source[i];
    if (inQuotes) {
      if (char === "\"") {
        if (source[i + 1] === "\"") { field += "\""; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }
    if (char === "\"") { inQuotes = true; i += 1; continue; }
    if (char === ",") { pushField(); i += 1; continue; }
    if (char === "\r") { i += 1; continue; }
    if (char === "\n") { pushRow(); i += 1; continue; }
    field += char; i += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((candidate) => !(candidate.length === 1 && candidate[0] === ""));
}

export type CsvRecord = Record<string, string>;

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function csvToRecords(text: string): CsvRecord[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = (row[index] ?? "").trim();
    });
    return record;
  });
}

export function splitList(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
