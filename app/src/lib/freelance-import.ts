// Shared, framework-free parsing for bulk timesheet import (paste or Excel/CSV upload).
// Used both client-side (to build a preview before anything is saved) and server-side
// (to re-validate the exact same rows before writing them).

export interface ParsedImportRow {
  epicName: string;
  description: string;
  hours: number;
  dateRaw: string;
  date: string | null; // YYYY-MM-DD, or null if unparseable
  notes: string;
}

/**
 * Parses tab-or-comma-delimited text into rows of cells, honoring quoted fields that
 * span multiple lines (the common case when a task description itself contains line
 * breaks, as when pasted straight out of Excel/Google Sheets).
 */
export function parseDelimitedText(text: string, delimiter: "\t" | ","): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentField += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      currentRow.push(currentField);
      currentField = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      i++;
      continue;
    }
    currentField += ch;
    i++;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

/** Auto-detects tab vs comma delimiting and parses accordingly. */
export function parseDelimitedTextAuto(text: string): string[][] {
  const delimiter = text.includes("\t") ? "\t" : ",";
  return parseDelimitedText(text, delimiter);
}

/**
 * Parses a date in the D/M/YYYY, D-M-YYYY, or YYYY-MM-DD shapes seen in exported
 * timesheets. Returns null (rather than guessing) for anything else — e.g. month-only
 * values like "Apr-26" or ranges like "30/05/2026 - 01/05/2026" — so the caller can
 * flag those rows for the user to fix by hand instead of silently mis-dating them.
 */
export function parseDateFlexible(raw: string): string | null {
  const trimmed = raw.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function stripSurroundingQuotes(value: string): string {
  return value.replace(/^"|"$/g, "").trim();
}

/**
 * Groups timesheet rows by their EPIC header ("EPICx-NAME  Completed tasks  Hours  Date  Notes")
 * and interprets each data row beneath it. Column layout: [row label, task description,
 * hours, date, story/scope note, optional payment-platform tag].
 */
export function interpretImportRows(rows: string[][]): ParsedImportRow[] {
  const results: ParsedImportRow[] = [];
  let currentEpicName: string | null = null;

  for (const cols of rows) {
    if (cols[1] && cols[1].trim() === "Completed tasks") {
      currentEpicName = cols[0].trim();
      continue;
    }
    if (!currentEpicName) continue;
    if (cols.length < 3) continue;

    const [, descriptionRaw, hoursRaw, dateRaw, storyNoteRaw, platformTagRaw] = cols;
    const hours = parseFloat((hoursRaw ?? "").trim());
    if (!Number.isFinite(hours) || hours <= 0) continue;

    const description = stripSurroundingQuotes(descriptionRaw ?? "");
    const date = parseDateFlexible(dateRaw ?? "");
    const storyNote = (storyNoteRaw ?? "").trim();
    const platformTag = (platformTagRaw ?? "").trim();
    const notes = platformTag ? `[${platformTag}] ${storyNote}`.trim() : storyNote;

    results.push({
      epicName: currentEpicName,
      description: description.length > 500 ? description.slice(0, 497) + "..." : description,
      hours,
      dateRaw: (dateRaw ?? "").trim(),
      date,
      notes: notes.length > 1000 ? notes.slice(0, 997) + "..." : notes,
    });
  }

  // Also accept a simple row-based export: optional serial number, task, hours,
  // date, notes. The caller supplies the target epic for these rows.
  if (results.length === 0) {
    for (const cols of rows) {
      const offset = /^\s*\d+\)?\s*$/.test(cols[0] ?? "") ? 1 : 0;
      if (cols.length < offset + 3) continue;
      const hours = parseFloat((cols[offset + 1] ?? "").trim());
      const dateRaw = (cols[offset + 2] ?? "").trim();
      if (!Number.isFinite(hours) || hours <= 0 || !dateRaw) continue;

      results.push({
        epicName: "",
        description: stripSurroundingQuotes(cols[offset] ?? "").slice(0, 500),
        hours,
        dateRaw,
        date: parseDateFlexible(dateRaw),
        notes: (cols[offset + 3] ?? "").trim().slice(0, 1000),
      });
    }
  }

  return results;
}
