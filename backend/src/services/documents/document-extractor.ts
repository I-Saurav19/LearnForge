import type { DocumentFileType } from "../../models/Document.js";
import { extractCsvText } from "./csv-extractor.js";
import { extractDocxText } from "./docx-extractor.js";
import { EmptyDocumentTextError, DocumentExtractionError, normalizeExtractedText } from "./normalize-text.js";
import { extractPdfText } from "./pdf-extractor.js";
import { extractPptText, extractPptxText } from "./ppt-extractor.js";
import { extractTextFile } from "./text-extractor.js";

export async function extractDocumentText(fileType: DocumentFileType, buffer: Buffer): Promise<string> {
  let raw: string;
  switch (fileType) {
    case "pdf": raw = await extractPdfText(buffer); break;
    case "docx": raw = await extractDocxText(buffer); break;
    case "ppt": raw = extractPptText(buffer); break;
    case "pptx": raw = await extractPptxText(buffer); break;
    case "txt": raw = extractTextFile(buffer); break;
    case "csv": raw = extractCsvText(buffer); break;
    default: throw new DocumentExtractionError("This document type is not supported.");
  }
  const normalized = normalizeExtractedText(raw);
  if (!normalized) throw new EmptyDocumentTextError(fileType);
  return normalized;
}
