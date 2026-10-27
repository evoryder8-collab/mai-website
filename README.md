# Mai — website

Personal site for **Mai**, Thai government–certified therapist and Therapist Chief at Memories Spa, Tsukuba.
3rd place & Special Award at a world championship in Thai traditional massage (the event's name isn't on the site yet).
The award film is from the Massage Championship World Tour 2025 ceremony.

Test URL: https://evoryder8-collab.github.io/mai-website/ (still `noindex`; remove the robots meta in `src/partials/head.html` at launch).

## Pages

| Page | File |
| --- | --- |
| Home (a section per page, each linking to it) | `index.html` |
| Award (story + ceremony film) | `award/index.html` |
| About | `about/index.html` |
| Treatments (Yu-fai, Nuat Thippaya, courses & prices) | `treatments/index.html` |
| Visit (address, hours, booking rules, 3D map) | `visit/index.html` |

Shared markup lives in `src/partials/` (head, header, footer, sash, band, cta) and is inlined by a small plugin in
`vite.config.js`: `<!-- partial:header -->` pulls in `src/partials/header.html`, `{{root}}` becomes the relative path
home, and the nav link matching `<body data-page>` gets `aria-current="page"`. New pages go in `PAGES` in `vite.config.js`.

## Stack

- **Vite** — dev server and multi-page build (`base: './'`, so it works under `/mai-website/`).
- **GSAP + ScrollTrigger + SplitText** — intro, floating glass cards with pointer tilt, scroll reveals, parallax (`src/motion.js`).
- **Lenis** — smooth scrolling, synced to GSAP's ticker.
- **three.js** — the saffron cloth behind each page's hero (`src/cloth.js`), loaded lazily.
- **Sash** (`src/sash.js`) — grab-and-fling marquee, same physics as the Lume Wellness award ribbon: 1:1 drag, release
  keeps the swipe speed, exponential return to cruising speed (0.72 s), page scroll gives it a push.
- **MapLibre GL JS 6.12.0** (pinned, same as AusMC) + **OpenFreeMap** tiles (no API key) — Visit map (`src/map.js`):
  starts on a globe of NASA Blue Marble imagery in a starfield, flies down to the salon with 3D buildings, then orbits.

With `prefers-reduced-motion`, Lenis and the scroll animations are off, the cloth renders a single still frame, the cards
rest at a fixed angle, the map opens at the salon without flying, and the video doesn't autoplay.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Editing content

Copy lives in each page's HTML (and `src/partials/`), in both languages side by side:

```html
<span data-l="ja">ご予約はこちら</span><span data-l="en">Book a session</span>
```

CSS shows whichever matches `<html lang>`. Page titles and descriptions per page and language are in `src/lang.js`.
Course prices on the Treatments page were copied from STORES in October 2026; STORES stays the source of truth.
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
