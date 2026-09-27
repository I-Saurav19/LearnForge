import mammoth from "mammoth";
import { DocumentExtractionError } from "./normalize-text.js";

export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch {
    throw new DocumentExtractionError("Unable to read this DOCX. Check that it is a valid, unprotected document.");
  }
}
