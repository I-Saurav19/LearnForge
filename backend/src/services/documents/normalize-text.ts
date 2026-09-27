export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

export class EmptyDocumentTextError extends DocumentExtractionError {
  constructor(fileType: string) {
    super(fileType === "pdf"
      ? "Unable to extract text from this PDF. The document may be scanned or image-based."
      : `No readable text could be extracted from this ${fileType.toUpperCase()} document.`);
    this.name = "EmptyDocumentTextError";
  }
}
