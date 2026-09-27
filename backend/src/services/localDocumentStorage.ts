import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import type { DocumentFileType } from "../models/Document.js";

const extensionByType: Record<DocumentFileType, string> = {
  pdf: ".pdf",
  docx: ".docx",
  ppt: ".ppt",
  pptx: ".pptx",
  txt: ".txt",
  csv: ".csv",
};

export class LocalDocumentStorage {
  readonly rootDirectory = path.resolve(env.documentUploadDirectory);

  private filePath(userId: string, documentId: string, fileType: DocumentFileType): string {
    return path.join(this.rootDirectory, userId, `${documentId}-${randomUUID()}${extensionByType[fileType]}`);
  }

  async save(userId: string, documentId: string, fileType: DocumentFileType, content: Buffer): Promise<string> {
    const targetPath = this.filePath(userId, documentId, fileType);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, { flag: "wx", mode: 0o600 });
    return path.relative(this.rootDirectory, targetPath);
  }

  private resolveStoredPath(storageKey: string): string {
    const targetPath = path.resolve(this.rootDirectory, storageKey);
    if (!targetPath.startsWith(`${this.rootDirectory}${path.sep}`)) {
      throw new Error("Invalid stored document path");
    }
    return targetPath;
  }

  async read(storageKey: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolveStoredPath(storageKey));
    } catch (error) {
      if (isFileNotFound(error)) return null;
      throw error;
    }
  }

  async restore(storageKey: string, content: Buffer): Promise<void> {
    const targetPath = this.resolveStoredPath(storageKey);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, { flag: "wx", mode: 0o600 });
  }

  async remove(storageKey: string): Promise<void> {
    const targetPath = this.resolveStoredPath(storageKey);
    await rm(targetPath, { force: true });
    const parent = path.dirname(targetPath);
    try {
      const remaining = await readdir(parent);
      if (remaining.length === 0) await rm(parent, { recursive: false });
    } catch {
      // Empty-directory cleanup is best effort; the stored file has already been removed.
    }
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export const localDocumentStorage = new LocalDocumentStorage();
