// File upload handling. Files land on disk under storage/uploads with a
// generated name; the `files` table keeps the metadata and the original name.

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const uploadDir = path.join(__dirname, "..", "..", "storage", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// 25 MB. Raise deliberately — the limit is what stops a single request
// filling the disk.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, done) => done(null, uploadDir),
  filename: (_req, file, done) => {
    // Never reuse the client's name on disk — it is attacker-controlled.
    const ext = path.extname(file.originalname).slice(0, 16);
    done(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
  fileFilter: (_req, file, done) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return done(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    done(null, true);
  },
});
