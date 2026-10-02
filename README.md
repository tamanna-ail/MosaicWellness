# Tamanna

A consumer health and wellness web app that turns daily healthy habits into a garden that grows with your streak.

- `index.html` — the app: a single self-contained HTML file (inline CSS and JS, no build step). Open it in a browser, or serve the repo root with any static host (GitHub Pages, Netlify, Vercel).
- `BRIEF.md` — the build brief: challenge requirements, current state, and the next set of gamification changes.

## How the game works

Tamanna works like a base-building game. Keeping your goals earns XP, and you spend that XP to build up your garden.

- **Register:** enter a name and choose lifestyle goals a wearable can't measure (no added sugar, removing makeup before sleep, walking 10,000 steps, or your own). Each goal has a difficulty that sets its XP: Easy 10, Steady 20, Hard 35. Goals can be added or removed later. New goals start the next day.
- **Earn:** finishing every goal adds a 25 XP day bonus, and the whole day is multiplied by the streak multiplier. The multiplier grows by ×1.1 for each goal day in a row (×1.8 on day 7, ×3.5 on day 14, ×6.7 on day 21, capped at ×10). A missed day resets it to ×1.
- **Build:** spend XP in the Shop.
  - **Greenhouse** (the town hall, levels 1–5): opens 4, 8, 12, 16, then 20 plots, and gates the other buildings and flowers.
  - **Water well** (levels 1–3): lowers drying on a missed day from 35% to 30%, 25%, then 20%.
  - **Beehive** (levels 1–3): +15% flower harvest per level.
  - **Decorations:** stepping stones, moon lantern, bird bath and garden swing add garden power.
- **Grow:** flowers, lowest to highest, are marigold (1 XP), sunflower (5), red rose (20) and pink lily (30). On every goal day each flower adds its XP to a harvest basket. Tap the basket in the garden to collect it. The sunflower unlocks after 5 goal days in a row, the red rose after 10 more, and the pink lily after 20 more. Each flower also needs a greenhouse level (1, 2, 3, 4).
- **Protect:** a missed day dries every flower by 35% (less with a well). It takes 3 goal days to recover to 100%, and no new flowers can be planted during those days. Flowers never die.
- **Clan:** a simulated weekly league ranks gardeners by garden power (buildings, flowers and decorations).

Gardens are stored per gardener in the browser's `localStorage` (key `tamanna-garden-v3`). Several gardeners can register on one device and switch between them.

Run locally:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```
