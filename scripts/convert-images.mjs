#!/usr/bin/env node
// Scales the generated images of a category down to the size the app uses, in place, as PNG.
// Only the images that are not converted yet are touched: a PNG that already fits the size is skipped, so it can
// be run again after adding images. The image keeps its aspect ratio and fits inside SIZE x SIZE (Lanczos), never
// scaled up. A `<name>-full.png` (the old convert.sh convention) is kept and written to `<name>.png`.
//
// Usage: node scripts/convert-images.mjs [category...]   default: items weapons armor
//        node scripts/convert-images.mjs --check items   only list what would be converted (exit 1 if any)
// Then run `make thumbs` so images/thumbs/ picks the new images up.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = { icons: 100 };
const DEFAULT_SIZE = 300;

const args = process.argv.slice(2);
const check = args.includes('--check');
const categories = args.filter((a) => !a.startsWith('--'));
if (categories.length === 0) categories.push('items', 'weapons', 'armor');

let pending = 0;
let converted = 0;
for (const category of categories) {
  const dir = join(root, 'images', category);
  if (!existsSync(dir)) {
    console.error(`images/${category} not found`);
    process.exit(1);
  }
  const size = SIZES[category] ?? DEFAULT_SIZE;
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
  for (const file of files) {
    const full = file.endsWith('-full.png');
    const target = full ? file.replace(/-full\.png$/, '.png') : file;
    if (!full && files.includes(file.replace(/\.png$/, '-full.png'))) continue; // written from its -full source
    const source = join(dir, file);
    const meta = await sharp(source).metadata();
    const fits = meta.format === 'png' && meta.width <= size && meta.height <= size;
    if (fits && !full) continue;
    if (full && existsSync(join(dir, target))) {
      const out = await sharp(join(dir, target)).metadata();
      if (out.width <= size && out.height <= size) continue;
    }
    pending++;
    const label = `images/${category}/${file} ${meta.width}x${meta.height}`;
    if (check) {
      console.log(`would convert ${label}`);
      continue;
    }
    const buffer = await sharp(source)
      .resize(size, size, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await sharp(buffer).toFile(join(dir, target));
    converted++;
    console.log(`converted ${label} -> images/${category}/${target} (max ${size}px)`);
  }
}
console.log(check ? `${pending} image(s) to convert` : `${converted} image(s) converted`);
if (check && pending > 0) process.exit(1);
