# Mai — website

One-page personal site for **Mai**, Thai government–certified therapist and Therapist Chief at Memories Spa, Tsukuba.
3rd Place & Special Award, Massage Championship World Tour 2025.

Test URL: https://evoryder8-collab.github.io/mai-website/ (still `noindex`; remove the robots meta in `index.html` at launch).

## Stack

- **Vite** — dev server and build (`base: './'`, so it works under `/mai-website/`).
- **GSAP + ScrollTrigger + SplitText** — intro, scroll reveals, parallax, sash marquee (`src/motion.js`).
- **Lenis** — smooth scrolling, synced to GSAP's ticker.
- **three.js** — the saffron cloth in the hero (`src/cloth.js`), loaded lazily.
- **MapLibre** + **OpenFreeMap** tiles (no API key) — restyled map in Visit (`src/map.js`), loaded when near.

With `prefers-reduced-motion`, Lenis and the scroll animations are off, the cloth renders a single still frame, and the video doesn't autoplay.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Editing content

All copy lives in `index.html`, in both languages side by side:

```html
<span data-l="ja">ご予約はこちら</span><span data-l="en">Book a session</span>
```

CSS shows whichever matches `<html lang>`. Page title and description per language are in `src/lang.js`.
Visitors get Japanese if their browser prefers it, English otherwise; `?lang=ja` / `?lang=en` forces one.

Booking links go to Memories Spa on STORES: `https://memories-spa33.stores.jp/reserve/MemoriesSpaTukuba`.

## Media

Originals go in `media-src/` (git-ignored: they carry camera/GPS metadata). Then:

```bash
npm run media
```

writes resized AVIF/JPEG photos, the share image and the web MP4 + poster to `public/media/`, with metadata stripped.
Needs `ffmpeg` on the PATH.

| Original | Web name |
| --- | --- |
| `IMG_0867.JPG` | `mai-stretch` (hero) |
| `IMG_0865.JPG` | `mai-cloth-smile` (about) |
| `IMG_0866.JPG` | `mai-cloth-pull` (Nuat Thippaya) |
| `IMG_0868.JPG` | `mai-forearm` (band, share image) |
| `mcwt-2025-award-ceremony.MOV` | `award-ceremony.mp4` |

The video loops its first 9 seconds muted; "Watch with sound" plays the full edit including the closing title card (`src/video.js`).
