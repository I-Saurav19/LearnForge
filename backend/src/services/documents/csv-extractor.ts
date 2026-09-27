import { parse } from "csv-parse/sync";
import { DocumentExtractionError } from "./normalize-text.js";

export function extractCsvText(buffer: Buffer): string {
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    const rows = parse(source, { bom: true, skip_empty_lines: true, relax_column_count: true }) as string[][];
    if (rows.length === 0) return "";
    const [headers, ...data] = rows;
    if (data.length === 0) return `Columns: ${headers.join(" | ")}`;
    return `Columns: ${headers.join(" | ")}\n${data.map((row, index) => `Row ${index + 1}: ${row.join(" | ")}`).join("\n")}`;
  } catch {
    throw new DocumentExtractionError("Unable to read this CSV. Check that it is valid UTF-8 CSV data.");
  }
}
