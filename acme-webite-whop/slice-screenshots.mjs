/**
 * Crops the tall full-page screenshots into readable slices so they can be
 * reviewed visually without a 27,000px image.
 */
import sharp from 'sharp';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.ACME_QA_DIR ?? path.join(os.tmpdir(), 'acme-jobs-qa', 'screenshots');
const OUT = process.env.ACME_QA_DIR ?? path.join(os.tmpdir(), 'acme-jobs-qa', 'slices');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const targets = process.argv.slice(2);
const files = targets.length
  ? targets.map((t) => path.join(DIR, t))
  : fs.readdirSync(DIR).map((f) => path.join(DIR, f));

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const base = path.basename(file, '.png');
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const slice = 1600;
  const count = Math.min(Math.ceil(height / slice), 8);
  const scale = Math.min(1, 900 / width);

  for (let i = 0; i < count; i += 1) {
    const top = i * slice;
    const h = Math.min(slice, height - top);
    if (h <= 0) break;
    await sharp(file)
      .extract({ left: 0, top, width, height: h })
      .resize({ width: Math.round(width * scale) })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(path.join(OUT, `${base}__part${i + 1}.png`));
  }
  console.log(`${base}: ${width}x${height} -> ${count} slices`);
}
