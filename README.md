# 🎧 Tune In — 8-bit MP3 player for iPhone

## Install (same GitHub Pages method as before)
1. Create a new GitHub repo (e.g. `tune-in`) → **Add file → Upload files** → drag in everything from this zip (keep the `css`, `js`, `icons` folders).
2. **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. Open the Pages link in **Safari** on your iPhone → **Share → Add to Home Screen**.
4. Launch it once while online (fonts get cached) — after that it works fully offline.

## Getting your music in
iOS doesn't let web apps read the Music app library, so Tune In imports audio files instead:
- Put songs in the **Files** app (iCloud Drive, On My iPhone, a USB drive, etc.).
- In Tune In: **Add Music → CHOOSE SONGS** → select a bunch (tap *Select* to multi-pick).
- Supports MP3, M4A/AAC (incl. DRM-free iTunes purchases), ALAC, WAV, AIFF, FLAC. Album art + tags are read automatically.
- No files handy? Hit **INSERT DEMO CARTRIDGE** for 3 built-in chiptunes.

## Controls
| Wheel | Action |
|---|---|
| Spin | Scroll menus · volume/scrub on Now Playing · change viz style · tweak EQ band |
| Center ● | Select · (Now Playing) swap wheel between Volume ↔ Scrub · (Viz) change colors |
| Hold ● | Song options (favorite, play next, go to album, delete) |
| MENU | Back |
| ⏮ / ⏭ | Prev / next song · hold to rewind / fast-forward |
| ⏯ | Play / pause (shuffles everything if nothing is playing) |

Tap album art for the full-screen visualizer (swipe ◀ ▶ for styles, swipe ▼ to exit).

## Lock screen tip
If music stops when you lock your phone, switch **Settings → Playback Mode → BACKGROUND**.
That mode plays straight through iOS (great for pocket listening); the EQ, volume slider and live visualizer
take a break (the visualizer fakes it with vibes). Flip back to **FULL FX** for the full experience.

## Updating later
Change `VERSION` in `sw.js` whenever you upload new files so phones pick up the update.
