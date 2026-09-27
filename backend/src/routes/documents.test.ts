import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-only-document-secret-for-signed-authenticated-tests";
  process.env.DOCUMENT_UPLOAD_DIR = ".test-document-uploads";
});

vi.mock("../services/documents/document-extractor.js", () => ({
  extractDocumentText: vi.fn().mockResolvedValue("Extracted study material"),
}));

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Document } from "../models/Document.js";
import { User } from "../models/User.js";
import app from "../app.js";
import { env } from "../config/env.js";
import { localDocumentStorage } from "../services/localDocumentStorage.js";
import { extractDocumentText } from "../services/documents/document-extractor.js";

const userA = "507f1f77bcf86cd799439011";
const userB = "507f1f77bcf86cd799439022";
const persistedDocuments = new Map<string, InstanceType<typeof Document>>();
const secret = env.authSecret as string;

const supportedUploads = [
  { filename: "study.pdf", mime: "application/pdf", content: Buffer.from("%PDF-1.7\nstudy") },
  { filename: "study.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml word/document.xml")]) },
  { filename: "study.ppt", mime: "application/vnd.ms-powerpoint", content: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
  { filename: "study.pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", content: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml ppt/presentation.xml")]) },
  { filename: "study.txt", mime: "text/plain", content: Buffer.from("study notes") },
  { filename: "study.csv", mime: "text/csv", content: Buffer.from("topic,notes\nbiology,cells") },
];

function sessionFor(userId: string) {
  const token = jwt.sign({}, secret, { subject: userId, expiresIn: "1h" });
  return `learnforge_session=${token}`;
}

function authenticated(userId: string, endpoint: string, method: "get" | "post" | "delete" = "post") {
  return request(app)[method](endpoint).set("Cookie", sessionFor(userId));
}

async function uploadFile(userId: string, file: (typeof supportedUploads)[number]) {
  return authenticated(userId, "/api/documents/upload")
    .attach("file", file.content, { filename: file.filename, contentType: file.mime });
}

function documentFor(userId: string) {
  return Array.from(persistedDocuments.values()).find((document) => String(document.userId) === userId);
}

describe("document API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    persistedDocuments.clear();
    vi.mocked(extractDocumentText).mockResolvedValue("Extracted study material");
    vi.spyOn(User, "findById").mockImplementation(((id: string) => ({
      select: vi.fn().mockResolvedValue({ id: String(id) }),
    })) as never);
    vi.spyOn(Document.prototype, "save").mockImplementation((function (this: InstanceType<typeof Document>) {
      persistedDocuments.set(this.id, this);
      return Promise.resolve(this);
    }) as never);
    vi.spyOn(Document.prototype, "deleteOne").mockImplementation((function (this: InstanceType<typeof Document>) {
      persistedDocuments.delete(this.id);
      return Promise.resolve(this);
    }) as never);
    vi.spyOn(Document, "find").mockImplementation(((filter: { userId: string }) => ({
      sort: () => ({ select: () => Promise.resolve(Array.from(persistedDocuments.values()).filter((document) => String(document.userId) === String(filter.userId))) }),
    })) as never);
    vi.spyOn(Document, "findOne").mockImplementation(((filter: { _id: string; userId: string }) => ({
      select: () => Promise.resolve(Array.from(persistedDocuments.values()).find((document) => document.id === filter._id && String(document.userId) === String(filter.userId)) ?? null),
    })) as never);
  });

  afterAll(async () => {
    await rm(localDocumentStorage.rootDirectory, { recursive: true, force: true });
  });

  it("allows an authenticated student to upload a PDF without exposing auth or storage data", async () => {
    const response = await uploadFile(userA, supportedUploads[0]!);
    expect(response.status).toBe(201);
    expect(response.body.document).toMatchObject({ filename: "study.pdf", fileType: "pdf" });
    expect(response.body.document).not.toHaveProperty("extractedText");
    expect(response.body.document).not.toHaveProperty("userId");
    expect(response.body.document).not.toHaveProperty("storageKey");
    expect(JSON.stringify(response.body)).not.toMatch(/password|token|storageKey/i);
    expect(documentFor(userA)?.userId.toString()).toBe(userA);
    expect(documentFor(userA)?.extractedText).toBe("Extracted study material");
    expect(documentFor(userA)?.storageKey).toBeTruthy();
  });

  it.each(supportedUploads)("accepts supported file type $filename", async (file) => {
    const response = await uploadFile(userA, file);
    expect(response.status).toBe(201);
    expect(response.body.document.fileType).toBe(file.filename.split(".").pop());
    expect(response.body.document).not.toHaveProperty("extractedText");
    expect(documentFor(userA)?.extractedText).toBe("Extracted study material");
  });

  it("rejects unsupported extensions and file content that does not match its type", async () => {
    const unsupported = await authenticated(userA, "/api/documents/upload").attach("file", Buffer.from("no"), { filename: "notes.exe", contentType: "application/octet-stream" });
    const mismatched = await authenticated(userA, "/api/documents/upload").attach("file", Buffer.from("not a pdf"), { filename: "notes.pdf", contentType: "application/pdf" });
    const wrongOpenXml = await authenticated(userA, "/api/documents/upload").attach("file", supportedUploads[1]!.content, { filename: "renamed.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    expect(unsupported.status).toBe(415);
    expect(mismatched.status).toBe(415);
    expect(wrongOpenXml.status).toBe(415);
  });

  it("rejects files over 10 MB", async () => {
    const response = await authenticated(userA, "/api/documents/upload").attach("file", Buffer.alloc(10 * 1024 * 1024 + 1, 0x61), { filename: "large.txt", contentType: "text/plain" });
    expect(response.status).toBe(413);
    expect(response.body.message).toContain("10 MB");
  });

  it("rejects uploads when the request is unauthenticated", async () => {
    const response = await request(app).post("/api/documents/upload").attach("file", supportedUploads[0]!.content, { filename: "study.pdf", contentType: "application/pdf" });
    expect(response.status).toBe(401);
    expect(persistedDocuments.size).toBe(0);
  });

  it("requires one file and returns a clear error when it is missing", async () => {
    const response = await authenticated(userA, "/api/documents/upload");
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Choose a file");
  });

  it("lists only the authenticated user's documents", async () => {
    await uploadFile(userA, supportedUploads[0]!);
    await uploadFile(userB, supportedUploads[1]!);
    const response = await authenticated(userA, "/api/documents", "get");
    expect(response.status).toBe(200);
    expect(response.body.documents).toHaveLength(1);
    expect(response.body.documents[0].filename).toBe("study.pdf");
    expect(response.body.documents[0]).not.toHaveProperty("extractedText");
    expect(JSON.stringify(response.body)).not.toMatch(/password|token|storageKey/i);
  });

  it("lets a user retrieve their document but not another user's document", async () => {
    await uploadFile(userA, supportedUploads[0]!);
    await uploadFile(userB, supportedUploads[1]!);
    const ownDocument = documentFor(userA)!;
    const otherDocument = documentFor(userB)!;
    const ownResponse = await authenticated(userA, `/api/documents/${ownDocument.id}`, "get");
    const otherResponse = await authenticated(userA, `/api/documents/${otherDocument.id}`, "get");
    expect(ownResponse.status).toBe(200);
    expect(ownResponse.body.document.filename).toBe("study.pdf");
    expect(ownResponse.body.document).not.toHaveProperty("extractedText");
    expect(otherResponse.status).toBe(404);
    expect(otherResponse.body.message).toBe("Document not found.");
  });

  it("deletes an owned document and its stored file", async () => {
    await uploadFile(userA, supportedUploads[0]!);
    const document = documentFor(userA)!;
    const fullPath = `${localDocumentStorage.rootDirectory}/${document.storageKey}`;
    expect(existsSync(fullPath)).toBe(true);
    const response = await authenticated(userA, `/api/documents/${document.id}`, "delete");
    expect(response.status).toBe(200);
    expect(existsSync(fullPath)).toBe(false);
    expect(persistedDocuments.has(document.id)).toBe(false);
  });

  it("does not let a user delete another user's document", async () => {
    await uploadFile(userB, supportedUploads[0]!);
    const document = documentFor(userB)!;
    const fullPath = `${localDocumentStorage.rootDirectory}/${document.storageKey}`;
    const response = await authenticated(userA, `/api/documents/${document.id}`, "delete");
    expect(response.status).toBe(404);
    expect(existsSync(fullPath)).toBe(true);
    expect(persistedDocuments.has(document.id)).toBe(true);
  });

  it("rejects malformed document IDs", async () => {
    const response = await authenticated(userA, "/api/documents/not-an-id", "get");
    expect(response.status).toBe(400);
  });

  it("stores a path-traversal filename as a safe basename", async () => {
    const response = await authenticated(userA, "/api/documents/upload")
      .attach("file", Buffer.from("safe study text"), { filename: "../../outside.txt", contentType: "text/plain" });
    expect(response.status).toBe(201);
    expect(response.body.document.filename).toBe("outside.txt");
    expect(response.body.document.filename).not.toContain("..");
    expect(documentFor(userA)?.storageKey).not.toContain("outside.txt");
  });

  it("returns a clean error if local file storage fails", async () => {
    vi.spyOn(localDocumentStorage, "save").mockRejectedValue(new Error("internal filesystem path"));
    const response = await uploadFile(userA, supportedUploads[0]!);
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Unable to store this file right now.");
    expect(JSON.stringify(response.body)).not.toContain("internal filesystem path");
  });

  it("cleans up the stored file if saving document metadata fails", async () => {
    vi.spyOn(Document.prototype, "save").mockRejectedValue(new Error("internal database details"));
    const storageSave = vi.spyOn(localDocumentStorage, "save");
    const response = await uploadFile(userA, supportedUploads[0]!);
    const storageKey = await storageSave.mock.results[0]?.value as string;
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Unable to save document details right now.");
    expect(persistedDocuments.size).toBe(0);
    expect(JSON.stringify(response.body)).not.toContain("internal database details");
    expect(await localDocumentStorage.read(storageKey)).toBeNull();
  });

  it("removes the uploaded file and document when extraction fails", async () => {
    vi.mocked(extractDocumentText).mockRejectedValueOnce(new Error("private parser detail"));
    const storageSave = vi.spyOn(localDocumentStorage, "save");
    const response = await uploadFile(userA, supportedUploads[0]!);
    const storageKey = await storageSave.mock.results[0]?.value as string;
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Unable to extract readable text from this document.");
    expect(persistedDocuments.size).toBe(0);
    expect(await localDocumentStorage.read(storageKey)).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain("private parser detail");
  });
});
