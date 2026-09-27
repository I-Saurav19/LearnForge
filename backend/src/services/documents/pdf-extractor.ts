import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { DocumentExtractionError } from "./normalize-text.js";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  let pdf: Awaited<ReturnType<typeof getDocument>['promise']> | undefined;
  try {
    // PDF.js transfers its input while parsing, so give it one bounded copy instead of the upload buffer.
    pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        } else {
          line += " ";
        }
      }
      if (line.trim()) lines.push(line);
      const pageText = lines.join("\n").trim();
      if (pageText) pages.push(`--- Page ${pageNumber} ---\n${pageText}`);
      page.cleanup();
    }
    return pages.join("\n\n");
  } catch {
    throw new DocumentExtractionError("Unable to read this PDF. Check that it is a valid, unprotected PDF file.");
  } finally {
    pdf?.cleanup();
  }
}
