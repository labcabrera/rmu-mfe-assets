#!/usr/bin/env node
// Writes WebP thumbnails of every base image in images/manifest.json (workspace spec 058, decision 11):
//   images/thumbs/128/<category>/<name>.webp   avatars and selectors
//   images/thumbs/512/<category>/<name>.webp   cards and detail images
// <name> is the file name without its extension. The image is scaled down with Lanczos to fit inside the size,
// never up: a smaller image is only converted. Thumbnails are generated, not versioned (images/thumbs/ is in
// .gitignore); run scripts/build-manifest.mjs first.
//
// Usage: node scripts/build-thumbs.mjs           write the missing or outdated thumbnails
//        node scripts/build-thumbs.mjs --clean   also delete the thumbnails whose source image is gone
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const thumbsDir = join(root, 'images', 'thumbs');
const SIZES = [128, 512];
const QUALITY = 80;

const manifestFile = join(root, 'images', 'manifest.json');
if (!existsSync(manifestFile)) {
  console.error('images/manifest.json not found: run node scripts/build-manifest.mjs first');
  process.exit(1);
}
const { images } = JSON.parse(readFileSync(manifestFile, 'utf8'));

const thumbPath = (size, image) =>
  join(thumbsDir, String(size), image.category, `${basename(image.path, extname(image.path))}.webp`);

const counts = { written: 0, skipped: 0, failed: 0, deleted: 0 };
const expected = new Set();
for (const image of images) {
  const source = join(root, image.path);
  const sourceTime = statSync(source).mtimeMs;
  for (const size of SIZES) {
    const target = thumbPath(size, image);
    expected.add(target);
    if (existsSync(target) && statSync(target).mtimeMs >= sourceTime) {
      counts.skipped++;
      continue;
    }
    try {
      mkdirSync(dirname(target), { recursive: true });
      await sharp(source)
        .resize(size, size, { fit: 'inside', withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
        .webp({ quality: QUALITY })
        .toFile(target);
      counts.written++;
    } catch (error) {
      counts.failed++;
      console.error(`${image.path} -> ${relative(root, target)}: ${error.message}`);
    }
  }
}

if (process.argv.includes('--clean') && existsSync(thumbsDir)) {
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (statSync(file).isDirectory()) {
        walk(file);
        if (!readdirSync(file).length) rmSync(file, { recursive: true });
      } else if (!expected.has(file)) {
        rmSync(file);
        counts.deleted++;
      }
    }
  };
  walk(thumbsDir);
}

console.log(
  `images/thumbs (${SIZES.join(', ')} px): ${images.length} images, ${counts.written} written, ` +
    `${counts.skipped} up to date, ${counts.deleted} deleted, ${counts.failed} failed`,
);
if (counts.failed) process.exit(1);
