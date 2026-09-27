import { Document as Docx, Paragraph, Packer } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractDocumentText } from "./document-extractor.js";
import { EmptyDocumentTextError, DocumentExtractionError } from "./normalize-text.js";

async function createPdf(pageTexts: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) pdf.addPage().drawText(text, { x: 40, y: 700, font });
  return Buffer.from(await pdf.save());
}

async function createDocx(paragraphs: string[]): Promise<Buffer> {
  const docx = new Docx({ sections: [{ children: paragraphs.map((text) => new Paragraph(text)) }] });
  return Packer.toBuffer(docx);
}

function createPptx(slideTexts: string[]): Buffer {
  const archive: Record<string, Uint8Array> = {};
  for (const [index, text] of slideTexts.entries()) {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    archive[`ppt/slides/slide${index + 1}.xml`] = new TextEncoder().encode(
      `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${escaped}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:sld>`,
    );
  }
  return Buffer.from(zipSync(archive));
}

describe("document text extraction", () => {
  it("extracts normal PDF text", async () => {
    expect(await extractDocumentText("pdf", await createPdf(["Biology notes"]))).toContain("Biology notes");
  });

  it("preserves multiple PDF pages", async () => {
    const text = await extractDocumentText("pdf", await createPdf(["First page", "Second page"]));
    expect(text).toContain("Page 1");
    expect(text).toContain("Page 2");
    expect(text.indexOf("First page")).toBeLessThan(text.indexOf("Second page"));
  });

  it("rejects image-only PDFs with a clear empty text error", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    await expect(extractDocumentText("pdf", Buffer.from(await pdf.save()))).rejects.toMatchObject({
      name: "EmptyDocumentTextError",
      message: "Unable to extract text from this PDF. The document may be scanned or image-based.",
    });
  });

  it("extracts DOCX paragraphs", async () => {
    const text = await extractDocumentText("docx", await createDocx(["First paragraph", "Second paragraph"]));
    expect(text).toContain("First paragraph\n\nSecond paragraph");
  });

  it("extracts text across PPTX slides", async () => {
    const text = await extractDocumentText("pptx", createPptx(["Slide one text", "Slide two text"]));
    expect(text).toContain("Slide 1");
    expect(text).toContain("Slide one text");
    expect(text).toContain("Slide 2");
    expect(text).toContain("Slide two text");
  });

  it("rejects invalid legacy PPT files cleanly", async () => {
    await expect(extractDocumentText("ppt", Buffer.from("invalid PPT"))).rejects.toBeInstanceOf(DocumentExtractionError);
  });

  it("extracts UTF-8 TXT files", async () => {
    expect(await extractDocumentText("txt", Buffer.from("Chapter one\nLesson two"))).toBe("Chapter one\nLesson two");
  });

  it("rejects empty TXT files", async () => {
    await expect(extractDocumentText("txt", Buffer.alloc(0))).rejects.toBeInstanceOf(EmptyDocumentTextError);
  });

  it("formats CSV headers and rows without changing cell data", async () => {
    const text = await extractDocumentText("csv", Buffer.from("topic,notes\nbiology,\"cells, tissues\"\nchemistry,atoms"));
    expect(text).toContain("Columns: topic | notes");
    expect(text).toContain("Row 1: biology | cells, tissues");
    expect(text).toContain("Row 2: chemistry | atoms");
  });

  it("rejects empty CSV files", async () => {
    await expect(extractDocumentText("csv", Buffer.alloc(0))).rejects.toBeInstanceOf(EmptyDocumentTextError);
  });

  it("rejects invalid UTF-8 and corrupted files cleanly", async () => {
    await expect(extractDocumentText("txt", Buffer.from([0xc3, 0x28]))).rejects.toBeInstanceOf(DocumentExtractionError);
    await expect(extractDocumentText("pdf", Buffer.from("not a PDF"))).rejects.toBeInstanceOf(DocumentExtractionError);
    await expect(extractDocumentText("docx", Buffer.from("not a DOCX"))).rejects.toBeInstanceOf(DocumentExtractionError);
    await expect(extractDocumentText("pptx", Buffer.from("not a PPTX"))).rejects.toBeInstanceOf(DocumentExtractionError);
  });

  it("rejects unsupported formats", async () => {
    await expect(extractDocumentText("nope" as never, Buffer.alloc(1))).rejects.toBeInstanceOf(DocumentExtractionError);
  });

  it("normalizes excessive blank lines while preserving paragraphs", async () => {
    expect(await extractDocumentText("txt", Buffer.from("First\r\n\r\n\r\nSecond"))).toBe("First\n\nSecond");
  });
});
