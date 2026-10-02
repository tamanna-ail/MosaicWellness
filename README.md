# Tamanna

A consumer health and wellness web app that turns daily healthy habits into a garden that grows with your streak.

- `index.html` — the app: a single self-contained HTML file (inline CSS and JS, no build step). Open it in a browser, or serve the repo root with any static host (GitHub Pages, Netlify, Vercel).
- `BRIEF.md` — the build brief: challenge requirements, current state, and the next set of gamification changes.

## Rules

- **Register:** enter a name and choose lifestyle goals a wearable can't measure (no added sugar, removing makeup before sleep, walking 10,000 steps, or your own). You can add or remove goals later in the You tab. New goals start the next day.
- **Goal day:** every active goal is checked off. Each goal day earns one flower to plant.
- **Flowers, lowest to highest:** marigold (1 XP), sunflower (5 XP), red rose (20 XP), pink lily (30 XP). Each planted flower earns its XP on every goal day, scaled by garden health.
- **Unlocks:** 5 goal days in a row unlock the sunflower, 10 more in a row unlock the red rose, and 20 more in a row unlock the pink lily. A missed day resets the count toward the next flower, but unlocked flowers stay unlocked.
- **Missed day:** every flower dries and shrivels by 35% for each missed day. It takes 3 goal days to recover to 100%, and you can't add a flower during those 3 days.

Gardens are stored per gardener in the browser's `localStorage` (key `tamanna-garden-v2`). Several gardeners can register on one device and switch between them.

Run locally:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```
