#!/usr/bin/env node
// Writes images/manifest.json: every base image of the application, with its category (its folder), type, size,
// dimensions and sha256 (workspace spec 057). rmu-api-media lists the base images from it, so adding an image is
// adding its file. Plain Node, no dependencies.
//
// Usage: node scripts/build-manifest.mjs           write the manifest
//        node scripts/build-manifest.mjs --check   only check the images (exit 1 on a problem)
//
// It fails when a folder is not an image category of rmu-api-media, or an image file cannot be read. Files that
// are not images (a convert.sh) are skipped.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imagesDir = join(root, 'images');

// The base categories of rmu-api-media (IMAGE_CATEGORIES), without user-data: those are uploads.
const CATEGORIES = ['actions', 'avatars', 'backgrounds', 'doc', 'generic', 'icons', 'items', 'npcs', 'photos', 'professions', 'races'];
const UPLOAD_FOLDERS = ['user-data'];
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/** Width and height from the header of a PNG, JPEG or WebP; null when the format is not understood. */
const dimensions = (buf, type) => {
  if (type === 'image/png' && buf.length > 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (type === 'image/jpeg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const length = buf.readUInt16BE(i + 2);
      // SOF0-SOF15, except DHT (c4), JPG (c8) and DAC (cc)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + length;
    }
    return null;
  }
  if (type === 'image/webp' && buf.toString('ascii', 0, 4) === 'RIFF') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
};

const problems = [];
const images = [];
for (const folder of readdirSync(imagesDir).sort()) {
  const dir = join(imagesDir, folder);
  if (!statSync(dir).isDirectory()) continue;
  if (UPLOAD_FOLDERS.includes(folder)) continue;
  if (!CATEGORIES.includes(folder)) {
    problems.push(`images/${folder}: not an image category (${CATEGORIES.join(', ')})`);
    continue;
  }
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name);
    if (!statSync(file).isFile()) {
      problems.push(`${relative(root, file)}: subfolders are not categories`);
      continue;
    }
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    const contentType = TYPES[ext];
    if (!contentType) continue;
    const buf = readFileSync(file);
    const size = dimensions(buf, contentType);
    if (!size) problems.push(`${relative(root, file)}: not a readable ${contentType}`);
    images.push({
      path: relative(root, file).split('\\').join('/'),
      category: folder,
      contentType,
      sizeBytes: buf.length,
      width: size?.width ?? null,
      height: size?.height ?? null,
      sha256: createHash('sha256').update(buf).digest('hex'),
    });
  }
}

if (problems.length) {
  console.error(`${problems.length} problems in images/:`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
if (process.argv.includes('--check')) {
  console.log(`images: ok (${images.length})`);
} else {
  const manifest = { version: 1, generatedAt: new Date().toISOString(), images };
  writeFileSync(join(imagesDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`images/manifest.json: ${images.length} images`);
}
