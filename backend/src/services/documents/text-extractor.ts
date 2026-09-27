import { TextDecoder } from "node:util";
import { DocumentExtractionError } from "./normalize-text.js";

export function extractTextFile(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new DocumentExtractionError("Unable to read this text file. Use a UTF-8 encoded file.");
  }
}
