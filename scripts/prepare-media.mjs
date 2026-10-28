// Turns the originals in media-src/ into web-ready files in public/media/.
// Run with `npm run media` after adding or replacing an original, or `npm run media -- dogs`
// (photos, logo, og, video, dogs, barks, sfx, music) to redo just one group.
// sharp drops EXIF/GPS metadata by default, and ffmpeg is told to do the same,
// so nothing from the camera ends up in the public repo.
import { mkdir } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
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

// Mai's dogs, as square portraits for the round frames: [left, top, size] around each face.
const DOGS = {
  'dog-latte.jpg': ['dog-latte', [50, 140, 740]],
  'dog-mugi.jpg': ['dog-mugi', [80, 200, 720]],
};

const only = process.argv[2];
const run = (group) => !only || only === group;

await mkdir(OUT, { recursive: true });

for (const [file, name] of run('photos') ? Object.entries(PHOTOS) : []) {
  for (const w of WIDTHS) {
    const img = sharp(`${SRC}/${file}`).rotate().resize({ width: w, withoutEnlargement: true });
    await img.clone().avif({ quality: 52, effort: 6 }).toFile(`${OUT}/${name}-${w}.avif`);
    await img.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(`${OUT}/${name}-${w}.jpg`);
  }
  console.log(`photo  ${file} -> ${name}-{${WIDTHS}}.{avif,jpg}`);
}

for (const [file, [name, [left, top, size]]] of run('dogs') ? Object.entries(DOGS) : []) {
  for (const w of [360, 720]) {
    const img = sharp(`${SRC}/${file}`).rotate().extract({ left, top, width: size, height: size }).resize(w, w);
    await img.clone().avif({ quality: 52, effort: 6 }).toFile(`${OUT}/${name}-${w}.avif`);
    await img.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(`${OUT}/${name}-${w}.jpg`);
  }
  console.log(`dog    ${file} -> ${name}-{360,720}.{avif,jpg}`);
}

// Her logo (transparent PNG), trimmed to the artwork. It goes to src/assets/ rather than
// public/, so the header, the portal and the CSS can all reference it with hashed paths.
if (run('logo')) {
  await mkdir('src/assets', { recursive: true });
  const logo = await sharp(`${SRC}/mai-logo.png`).trim().toBuffer();
  for (const w of [320, 720, 1200]) {
    const img = sharp(logo).resize({ width: w });
    await img.clone().avif({ quality: 60, effort: 6 }).toFile(`src/assets/mai-logo-${w}.avif`);
    await img.clone().webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(`src/assets/mai-logo-${w}.webp`);
  }
  console.log('logo   mai-logo.png -> src/assets/mai-logo-{320,720,1200}.{avif,webp}');
}

// Two chihuahua barks for the moment Latte and Mugi land (dogs.js): from the first bark,
// three seconds, levelled to the same loudness and fading out smoothly to the end.
const BARKS = {
  'bark-playful.wav': ['bark-latte', 0.14],
  'bark-small.wav': ['bark-mugi', 0],
};
if (run('barks')) {
  await mkdir('src/assets', { recursive: true });
  for (const [file, [name, start]] of Object.entries(BARKS)) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${SRC}/${file}`, '-map_metadata', '-1',
      '-af', `atrim=start=${start}:duration=3,asetpts=PTS-STARTPTS,loudnorm=I=-19:TP=-2:LRA=11,afade=t=in:d=0.01,afade=t=out:st=1.8:d=1.2`,
      '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', `src/assets/${name}.mp3`], { stdio: 'inherit' });
    console.log(`sound  ${file} -> src/assets/${name}.mp3`);
  }
}

// The site's sound effects (sound.js): CC0 recordings from Freesound, found through Openverse
// (credits in the README), kept in media-src/sfx/ under their Freesound ids. Each is cut to
// its one event — [start, length, fade out] in seconds — cleared of DC and rumble, faded and
// given 10 ms of silence in front so it never clicks, and levelled to the same peak (with
// headroom for the MP3's overshoot); sound.js sets how loud each one plays.
const SFX = {
  tap: ['219162', 0, 0.3, 0.12], // Jagadamba, "FrogBlock05": a soft wooden tok
  hover: ['394795', 0.045, 0.7, 0.4], // LanooskiProductions, "Ding": a small glass ting
  chime: ['398496', 0, 3.2, 1.6], // Anthousai, "wind chimes - single 04": one chime
  tick: ['534094', 0.025, 0.3, 0.12], // pbimal, "clock-tick-01": one clock tick
  bowl: ['411481', 0.035, 8, 3], // s-light, "singing bowl - single strike 4"
  swish: ['495390', 5.03, 0.85, 0.3], // Nox_Sound, "Foley_Whoosh_Clothes": the fifth swish
  flight: ['80937', 0, 9.5, 2.5], // Tony B kksm, "gust of wind": swells to its peak at 5.5 s
};
if (run('sfx')) {
  await mkdir('src/assets', { recursive: true });
  for (const [name, [id, start, length, fadeOut]] of Object.entries(SFX)) {
    const input = ['-ss', String(start), '-t', String(length), '-i', `${SRC}/sfx/${id}.mp3`];
    const shape = `highpass=f=40,afade=t=in:d=0.004,afade=t=out:st=${(length - fadeOut).toFixed(3)}:d=${fadeOut},adelay=10:all=1`;
    // Two passes: find the peak, then level it to -3 dBFS.
    const probe = spawnSync('ffmpeg', ['-hide_banner', ...input, '-af', `${shape},volumedetect`, '-ac', '1', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const peak = parseFloat(probe.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? '0');
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...input, '-map_metadata', '-1',
      '-af', `${shape},volume=${(-3 - peak).toFixed(2)}dB`,
      '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', `src/assets/sfx-${name}.mp3`], { stdio: 'inherit' });
    console.log(`sound  sfx/${id}.mp3 -> src/assets/sfx-${name}.mp3 (${(-3 - peak).toFixed(1)} dB)`);
  }
}

// Her background music ("Weightless Clouds 2"): levelled, without its tags or cover art,
// fading in and out at the ends so the loop comes round softly.
if (run('music')) {
  const MUSIC = `${SRC}/weightless-clouds-2.mp3`;
  const length = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', MUSIC]));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', MUSIC, '-map', '0:a', '-map_metadata', '-1',
    '-af', `loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=2,afade=t=out:st=${(length - 4).toFixed(2)}:d=4`,
    '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', 'src/assets/mai-music.mp3'], { stdio: 'inherit' });
  console.log('sound  weightless-clouds-2.mp3 -> src/assets/mai-music.mp3');
}

// Link preview for LINE, iMessage, social apps.
if (run('og')) {
  await sharp(`${SRC}/IMG_0868.JPG`)
    .rotate()
    .resize(1200, 630, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${OUT}/og-image.jpg`);
  console.log('photo  IMG_0868.JPG -> og-image.jpg');
}

if (run('video')) {
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
}
