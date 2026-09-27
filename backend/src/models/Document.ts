import { Schema, model, type Types } from "mongoose";

export const supportedDocumentTypes = ["pdf", "docx", "ppt", "pptx", "txt", "csv"] as const;
export type DocumentFileType = (typeof supportedDocumentTypes)[number];

export interface DocumentRecord {
  userId: Types.ObjectId;
  filename: string;
  fileType: DocumentFileType;
  extractedText: string | null;
  storageKey: string;
  createdAt: Date;
}

const documentSchema = new Schema<DocumentRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    filename: { type: String, required: true, trim: true, maxlength: 180 },
    fileType: { type: String, required: true, enum: supportedDocumentTypes },
    extractedText: { type: String, default: null },
    storageKey: { type: String, required: true, select: false },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

documentSchema.index({ userId: 1, createdAt: -1 });

export const Document = model<DocumentRecord>("Document", documentSchema);
