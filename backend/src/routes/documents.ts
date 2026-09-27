import { TextDecoder } from "node:util";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { requireAuth } from "../middleware/requireAuth.js";
import { Document, supportedDocumentTypes, type DocumentFileType, type DocumentRecord } from "../models/Document.js";
import { extractDocumentText } from "../services/documents/document-extractor.js";
import { DocumentExtractionError } from "../services/documents/normalize-text.js";
import { localDocumentStorage } from "../services/localDocumentStorage.js";

const maxFileSizeBytes = 10 * 1024 * 1024;
const supportedTypes = new Set<string>(supportedDocumentTypes);
const fileSignatures: Record<DocumentFileType, (buffer: Buffer) => boolean> = {
  pdf: (buffer) => buffer.subarray(0, 5).toString("ascii") === "%PDF-",
  docx: (buffer) => hasZipSignature(buffer) && hasZipEntry(buffer, "word/document.xml"),
  pptx: (buffer) => hasZipSignature(buffer) && hasZipEntry(buffer, "ppt/presentation.xml"),
  ppt: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  txt: (buffer) => isUtf8Text(buffer),
  csv: (buffer) => isUtf8Text(buffer),
};
const allowedMimeTypes: Record<DocumentFileType, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
};

class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes, files: 1, fields: 8, parts: 10, fieldSize: 8 * 1024 },
  fileFilter: (_request, file, callback) => {
    const fileType = getFileType(file.originalname);
    if (!fileType) {
      callback(new UploadValidationError("This file type is not supported. Upload a PDF, DOCX, PPT, PPTX, TXT, or CSV file."));
      return;
    }
    callback(null, true);
  },
});

const documentsRouter = Router();
documentsRouter.use(requireAuth);

function parseUpload(request: Request, response: Response, next: NextFunction): void {
  upload.single("file")(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({ message: "The file is too large. Maximum file size is 10 MB." });
      return;
    }
    if (error instanceof UploadValidationError) {
      response.status(415).json({ message: error.message });
      return;
    }
    response.status(400).json({ message: "The upload request is invalid. Choose one file and try again." });
  });
}

function getFileType(filename: string): DocumentFileType | null {
  const basename = filename.split(/[\\/]/).pop() ?? "";
  const extension = path.extname(basename).slice(1).toLowerCase();
  return supportedTypes.has(extension) ? extension as DocumentFileType : null;
}

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function hasZipSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2] ?? -1);
}

function hasZipEntry(buffer: Buffer, entryName: string): boolean {
  return buffer.includes(Buffer.from(entryName, "ascii")) && buffer.includes(Buffer.from("[Content_Types].xml", "ascii"));
}

function isAllowedMimeType(fileType: DocumentFileType, mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return allowedMimeTypes[fileType].includes(normalized) || normalized === "application/octet-stream";
}

function safeFilename(originalName: string, fileType: DocumentFileType): string {
  const basename = (originalName.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  const expectedExtension = `.${fileType}`;
  const withoutExtension = basename.toLowerCase().endsWith(expectedExtension)
    ? basename.slice(0, -expectedExtension.length)
    : path.parse(basename).name;
  const safeBase = withoutExtension.replace(/[. ]+$/g, "").slice(0, 160) || "study-material";
  return `${safeBase}${expectedExtension}`;
}

function hasValidContent(file: Express.Multer.File, fileType: DocumentFileType): boolean {
  return isAllowedMimeType(fileType, file.mimetype) && fileSignatures[fileType](file.buffer);
}

function publicDocument(document: Pick<DocumentRecord, "filename" | "fileType" | "createdAt"> & { id?: string; _id?: { toString(): string } }) {
  return {
    id: document.id ?? document._id?.toString(),
    filename: document.filename,
    fileType: document.fileType,
    createdAt: document.createdAt,
  };
}

function validDocumentId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

documentsRouter.post("/upload", parseUpload, async (request: Request, response: Response) => {
  if (!request.file) {
    response.status(400).json({ message: "Choose a file to upload." });
    return;
  }

  const fileType = getFileType(request.file.originalname);
  if (!fileType || !hasValidContent(request.file, fileType)) {
    response.status(415).json({ message: "The file content does not match a supported file type." });
    return;
  }

  const document = new Document({
    userId: request.userId,
    filename: safeFilename(request.file.originalname, fileType),
    fileType,
    extractedText: null,
  });

  let storageKey: string;
  try {
    storageKey = await localDocumentStorage.save(String(request.userId), document.id, fileType, request.file.buffer);
  } catch {
    response.status(500).json({ message: "Unable to store this file right now." });
    return;
  }

  document.storageKey = storageKey;
  try {
    await document.save();
  } catch {
    try {
      await localDocumentStorage.remove(storageKey);
    } catch {
      // Keep the API error non-sensitive; a failed cleanup can be retried operationally.
    }
    response.status(500).json({ message: "Unable to save document details right now." });
    return;
  }

  let extractedText: string;
  try {
    extractedText = await extractDocumentText(fileType, request.file.buffer);
  } catch (error) {
    await document.deleteOne().catch(() => undefined);
    await localDocumentStorage.remove(storageKey).catch(() => undefined);
    if (error instanceof DocumentExtractionError) {
      response.status(422).json({ message: error.message });
    } else {
      response.status(422).json({ message: "Unable to extract readable text from this document." });
    }
    return;
  }

  document.extractedText = extractedText;
  try {
    await document.save();
  } catch {
    await document.deleteOne().catch(() => undefined);
    await localDocumentStorage.remove(storageKey).catch(() => undefined);
    response.status(500).json({ message: "Unable to save extracted document text right now." });
    return;
  }

  response.status(201).json({ document: publicDocument(document) });
});

documentsRouter.get("/", async (request: Request, response: Response) => {
  try {
    const documents = await Document.find({ userId: request.userId })
      .sort({ createdAt: -1 })
      .select("filename fileType createdAt");
    response.json({ documents: documents.map(publicDocument) });
  } catch {
    response.status(500).json({ message: "Unable to load your documents right now." });
  }
});

documentsRouter.get("/:id", async (request: Request, response: Response) => {
  const documentId = Array.isArray(request.params.id) ? request.params.id[0] ?? "" : request.params.id;
  if (!validDocumentId(documentId)) {
    response.status(400).json({ message: "The document ID is invalid." });
    return;
  }
  try {
    const document = await Document.findOne({ _id: documentId, userId: request.userId })
      .select("filename fileType createdAt");
    if (!document) {
      response.status(404).json({ message: "Document not found." });
      return;
    }
    response.json({ document: publicDocument(document) });
  } catch {
    response.status(500).json({ message: "Unable to load this document right now." });
  }
});

documentsRouter.delete("/:id", async (request: Request, response: Response) => {
  const documentId = Array.isArray(request.params.id) ? request.params.id[0] ?? "" : request.params.id;
  if (!validDocumentId(documentId)) {
    response.status(400).json({ message: "The document ID is invalid." });
    return;
  }

  try {
    const document = await Document.findOne({ _id: documentId, userId: request.userId }).select("+storageKey");
    if (!document) {
      response.status(404).json({ message: "Document not found." });
      return;
    }
    const content = await localDocumentStorage.read(document.storageKey);
    await localDocumentStorage.remove(document.storageKey);
    try {
      await document.deleteOne();
    } catch {
      if (content) await localDocumentStorage.restore(document.storageKey, content).catch(() => undefined);
      response.status(500).json({ message: "Unable to delete this document right now." });
      return;
    }
    response.json({ message: "Document deleted." });
  } catch {
    response.status(500).json({ message: "Unable to delete this document right now." });
  }
});

export default documentsRouter;
