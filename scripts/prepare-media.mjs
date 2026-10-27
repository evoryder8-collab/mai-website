// Turns the originals in media-src/ into web-ready files in public/media/.
// Run with `npm run media` after adding or replacing an original.
// sharp drops EXIF/GPS metadata by default, and ffmpeg is told to do the same,
// so nothing from the camera ends up in the public repo.
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const SRC = 'media-src';
const OUT = 'public/media';
const WIDTHS = [640, 1080, 1600];

const PHOTOS = {
  'IMG_0867.JPG': 'mai-stretch',
  'IMG_0865.JPG': 'mai-cloth-smile',
  'IMG_0866.JPG': 'mai-cloth-pull',
  'IMG_0868.JPG': 'mai-forearm',
};

await mkdir(OUT, { recursive: true });

for (const [file, name] of Object.entries(PHOTOS)) {
  for (const w of WIDTHS) {
    const img = sharp(`${SRC}/${file}`).rotate().resize({ width: w, withoutEnlargement: true });
    await img.clone().avif({ quality: 52, effort: 6 }).toFile(`${OUT}/${name}-${w}.avif`);
    await img.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(`${OUT}/${name}-${w}.jpg`);
  }
  console.log(`photo  ${file} -> ${name}-{${WIDTHS}}.{avif,jpg}`);
}

// Link preview for LINE, iMessage, social apps.
await sharp(`${SRC}/IMG_0868.JPG`)
  .rotate()
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(`${OUT}/og-image.jpg`);
console.log('photo  IMG_0868.JPG -> og-image.jpg');

const VIDEO = `${SRC}/mcwt-2025-award-ceremony.MOV`;
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

ffmpeg(
  '-i', VIDEO,
  '-map_metadata', '-1',
  '-vf', 'scale=720:-2,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '128k',
  '-movflags', '+faststart',
  `${OUT}/award-ceremony.mp4`,
);
console.log('video  award-ceremony.mp4');

// Poster: Mai holding the plaque, before the title card fades in.
ffmpeg('-ss', '6.6', '-i', VIDEO, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', `${OUT}/award-ceremony-poster.jpg`);
console.log('video  award-ceremony-poster.jpg');
