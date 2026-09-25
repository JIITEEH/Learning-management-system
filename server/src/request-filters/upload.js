// File upload handling. Files land on disk in server/uploads with a
// generated name; the `files` table keeps the metadata and the original name.

import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import multer from 'multer';
import config from '../config/index.js';
import { HttpError } from '../helpers/httpError.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

// 25 MB. Raise deliberately — the limit is what stops a single request
// filling the disk.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, done) => done(null, config.uploadDir),
  filename: (_req, file, done) => {
    // Never reuse the client's name on disk — it is attacker-controlled.
    // Even the extension is kept only when it is plain letters and digits,
    // so a name such as "notes.pdf%00.html" cannot smuggle anything through.
    const ext = path.extname(file.originalname);
    const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext.toLowerCase() : '';
    done(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
  fileFilter: (_req, file, done) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      // 415 "unsupported media type": the sender's mistake, not a server
      // fault, so it must not be reported as a 500.
      return done(new HttpError(415, `Unsupported file type: ${file.mimetype}`));
    }
    done(null, true);
  },
});
