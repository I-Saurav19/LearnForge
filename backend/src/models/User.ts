import { Schema, model } from "mongoose";

export interface UserDocument {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

export const User = model<UserDocument>("User", userSchema);
