import { createRequire } from "node:module";
import { DOMParser } from "@xmldom/xmldom";
import { unzipSync } from "fflate";
import { DocumentExtractionError } from "./normalize-text.js";

const loadLegacyModule = createRequire(__filename);
const legacyPpt = loadLegacyModule("ppt-to-text") as {
  readBuffer(buffer: Buffer): unknown;
  utils: { to_text(presentation: unknown): string[] };
};

export async function extractPptxText(buffer: Buffer): Promise<string> {
  try {
    const archive = unzipSync(buffer);
    const slideFiles = Object.keys(archive)
      .map((name) => ({ name, match: name.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
      .filter((entry): entry is { name: string; match: RegExpMatchArray } => entry.match !== null)
      .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));
    if (slideFiles.length === 0) throw new Error("No slides");
    const parser = new DOMParser();
    return slideFiles.map(({ name, match }) => {
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(archive[name]);
      const document = parser.parseFromString(xml, "application/xml");
      const values = Array.from(document.getElementsByTagName("a:t"))
        .map((node) => node.textContent ?? "")
        .filter((text) => text.trim());
      return `--- Slide ${match[1]} ---\n${values.join(" ")}`;
    }).join("\n\n");
  } catch {
    throw new DocumentExtractionError("Unable to read this PPTX. Check that it is a valid presentation.");
  }
}

export function extractPptText(buffer: Buffer): string {
  try {
    const presentation = legacyPpt.readBuffer(buffer);
    return legacyPpt.utils.to_text(presentation)
      .map((text, index) => `--- Slide ${index + 1} ---\n${text}`)
      .join("\n\n");
  } catch {
    throw new DocumentExtractionError("Unable to read this PPT. Check that it is a valid presentation.");
  }
}
