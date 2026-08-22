import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../lib/errors.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

export function ensureUploadDir() {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, uploadRoot);
  },
  // The client-supplied filename is never used - it is attacker-controlled and
  // could contain path separators or a misleading extension.
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomBytes(16).toString('hex')}${EXT_BY_MIME[file.mimetype] ?? ''}`);
  },
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) {
      cb(ApiError.badRequest('Only JPEG, PNG and WebP images are accepted'));
      return;
    }
    cb(null, true);
  },
}).single('image');

/** Public URL for a stored file, served by the static handler in app.ts. */
export const publicUrlFor = (filename: string) => `/uploads/${filename}`;

/** Best-effort removal of a file this API previously stored. */
export function removeUploaded(url: string | null | undefined) {
  if (!url?.startsWith('/uploads/')) return;
  const name = path.basename(url);
  fs.rm(path.join(uploadRoot, name), { force: true }, () => {});
}
