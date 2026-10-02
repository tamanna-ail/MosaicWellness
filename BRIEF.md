# Tamanna: Build Brief

This brief describes a consumer health and wellness web app called **Tamanna**, built for the CEO's Office Builder Round Challenge. It contains the challenge requirements verbatim, the current state of the app, and the gamification changes to implement next. The current working version is a single self-contained HTML file, `tamanna.html`, supplied alongside this brief.

---

## 1. Builder Round requirements (verbatim)

> **CEO's Office | Builder Round Challenge: Health & Wellness App**
>
> Build a consumer health & wellness app
>
> Build something people would want to use. Surprise us.
>
> **THE PROBLEM**
>
> Use Codex, Claude, or a similar coding agent to build a consumer-facing health and wellness web app. The brief is deliberately open-ended: choose the problem, the audience, and the experience. A tracker, an AI coach, or a way to find people to play a sport are only starting points. Bring your own idea.
>
> **YOUR TASK**
>
> Choose an idea and build a working app. Show your taste, creativity, and attention to detail through an experience that is useful and enjoyable for the person using it.
>
> Answer format: A working app link and a short explanation of what you built.
>
> **RULES OF THE GAME**
>
> • Use Codex, Claude, or a similar coding agent. You may use AI to research, design, write code, test, and debug.
>
> • Make the main experience easy to try. A concept, slide deck, or mock-up alone is not a working app.
>
> • Submit your own work. Be ready to explain the problem you chose, your decisions, and how AI helped you.
>
> **WHAT TO SUBMIT**
>
> • A working link to your app
>
> • A short description of who it is for, what it does, and what makes it interesting
>
> • Optional: source code, demo video, and AI tools used
>
> **Submit Your Build**
>
> Submit your working app link by 3rd October, 15:00 (3 PM). Builder Round Submission.

**Deadline:** 3 October 2026, 15:00 IST. Everything below must ship as a working, publicly accessible web app before then.

---

## 2. Problem and concept

**Problem.** People start healthy habits with enthusiasm and abandon them within about two weeks. Logging healthy behaviour is a chore with no immediate reward, and motivation fades faster than the habit forms.

**Audience.** Young adults who want to eat better, move more and sleep properly, and who already respond to streak mechanics in apps such as Duolingo and Snapchat.

**Concept.** Tamanna turns daily healthy habits into a garden that grows with the user's streak. Each habit earns a specific plant or decoration, every good day helps the garden grow, and a missed day makes the garden wilt. The app combines two proven mechanisms:

- **Duolingo:** daily streaks, small achievable daily targets, XP and levels, weekly leagues with promotion, streak freezes, and loss aversion.
- **Snapchat:** shared streaks between two friends that continue only while both people keep up, creating social obligation.

---

## 3. Current state of the app (already built)

The app is a single HTML file with inline CSS and JavaScript and no build step. State is saved to `localStorage` under the key `tamanna-garden-v1`. It opens on a 12-day sample garden behind a welcome sheet offering "Start my garden" or "Explore a 12-day sample".

### 3.1 Daily quests
- 11 quests across four domains: Eat well, Move, Rest, Mind.
- A day counts as complete once any **3** quests are done. This is the streak threshold.
- XP: 10 per quest, plus a 20 XP bonus for a complete day. Level = floor(XP / 120) + 1.
- Quests can be unmarked on the same day, which reverses their XP and item.

### 3.2 Quest-to-item mapping

| Quest | Domain | Reward |
|---|---|---|
| Vegetables with two meals | Eat well | Marigold |
| Eight glasses of water | Eat well | Lotus pond |
| One home-cooked meal | Eat well | Tulsi pot |
| No sugary drinks today | Eat well | Visitor: butterflies (today only) |
| Walk 7,000 steps | Move | Stepping stones |
| 20 minutes of exercise | Move | Mango tree |
| Stretch for 10 minutes | Move | Jasmine vine |
| In bed by 11 pm | Rest | Moon lantern |
| No screens in the hour before bed | Rest | Visitor: fireflies (tonight) |
| 15 minutes outdoors in daylight | Mind | Sunflower |
| Five minutes of slow breathing | Mind | Bird bath |

### 3.3 Garden
- A 5 × 4 grid of 20 plots. 6 are open at the start, and 2 more open for every 3 days of **best** streak.
- Earned items go to the **Shed**. The user taps an empty plot to plant an item, or taps a planted item to see its growth or return it to the shed (which resets growth).
- Plants grow through four stages, Seed → Sprout → Growing → In bloom, counted in good days since planting. Each plant has its own thresholds; trees take longest. Decorations (stones, lantern, bird bath, swing) do not grow.
- All plants are hand-drawn inline SVG, with a gentle sway animation.
- The sky follows the real time of day (dawn, day, dusk, night). The lantern and fireflies glow after dusk.
- **Wilting:** if yesterday was missed and today is not yet complete, the garden desaturates and droops until the user completes 3 quests. Plants never die.

### 3.4 Streak protection and milestones
- **Shade net** (the streak freeze): one is earned every 7 streak days, to a maximum of 2. Shade nets are applied automatically to cover missed days, but only when enough nets exist to cover the whole gap.
- **Milestones:** day 3 brings a garden swing; day 7 a gulmohar tree (plus a shade net); day 14 a peacock that lives in the garden; day 30 a golden lotus.
- Completing a day shows a celebration sheet with the streak number, any rewards, and falling petals. This respects `prefers-reduced-motion`.

### 3.5 Tabs
1. **Today:** the garden scene, today's progress, the next milestone, and the quest list.
2. **Garden:** the interactive garden, the shed, and the growth stages.
3. **Neighbours:** buddy streaks with two friends and a weekly "Marigold League" leaderboard. These are **simulated** with deterministic pseudo-randomness, and the app says so.
4. **You:** stats, level, a five-week calendar, milestone badges, an explanation of how the app works, and demo controls: "Jump to tomorrow", "Load sample garden", and "Start a fresh garden" with an in-page confirmation step.

### 3.6 Design
- Display font: DynaPuff. Body font: Figtree (both from Google Fonts).
- Leaf-green and marigold-orange accents, with full light and dark themes defined through CSS custom properties.
- Mobile-first single column (maximum width 520px) with a fixed bottom tab bar.
- No emoji. All illustration is SVG.

---

## 4. The problem to fix: the garden has no incentive

The garden currently works as a trophy cabinet. It looks pleasant but gives the user nothing back, so the only real incentive is still the streak counter. There are four specific gaps:

1. Rewards end at placement; nothing the garden produces feeds back into the game.
2. Planting involves no choices; placement and combinations make no difference.
3. Neglect costs almost nothing; wilting is cosmetic and reverses immediately.
4. No one else sees the garden; the league ranks raw XP, not the garden.

---

## 5. Changes to implement now (in priority order)

### 5.1 Harvest economy
- Each **blooming** plant yields produce on every completed day, for example marigold petals, mangoes, tulsi leaves, sunflower seeds, lotus seeds and jasmine flowers.
- Produce converts to a single currency (suggested name: **petals**), shown in the top bar next to the streak.
- A **Market** (a section in the Garden tab, or a fifth tab) sells rare seeds, decorations and shade nets for petals.
- Harvest is collected with a satisfying tap-to-collect interaction in the garden, not credited silently.
- Effect: the garden becomes a productive asset, so a missed day costs income.

### 5.2 Balanced-garden sets (adjacency bonuses)
- Certain combinations planted in adjacent plots (sharing an edge) form a **set** that grants a bonus. Suggested sets:
  - **Kitchen garden:** tulsi + marigold + mango. Doubles harvest from those plants.
  - **Pollinator corner:** sunflower + jasmine + lotus. Bees visit and the whole garden's harvest rises by 25%.
  - **Night garden:** moon lantern + jasmine + bird bath. Fireflies every night.
  - **Balanced bed:** one item from each of the four domains, adjacent. Grants the largest bonus.
- The strongest sets require items from all four domains, so the game rewards a balanced lifestyle rather than repeating the easiest habit.
- Show active sets visibly in the garden (an outline or glow around the tiles) and list discovered and undiscovered sets in a **Set book**.

### 5.3 Real stakes for neglect
- Each missed day (not covered by a shade net) grows **weeds** on empty or planted plots.
- Weeds block harvest from the plots they occupy. Each completed quest clears one weed.
- After **three** consecutive missed days, every plant drops back one growth stage. Plants never die.

### 5.4 Mystery seed packet
- Completing a day awards a **seed packet** that opens with an animation and a random rarity:
  - Common, about 70%: a standard seed.
  - Rare, about 25%: a rare plant, for example a hibiscus or bougainvillea.
  - Golden, about 5%: a golden variant that produces triple harvest.
- Rare and golden plants exist only through packets and the market.

### 5.5 Update existing systems
- Change the league ranking from raw XP to **garden value** (the sum of plant stages and rarity) or weekly harvest.
- Update the "How Tamanna works" section, the sample garden (include an active set, some produce and one weed), and the celebration sheet to reflect the new systems.
- Keep "Jump to tomorrow" working with all new systems, so a judge can watch harvests, weeds, regression and packets within a minute.

---

## 6. Roadmap (describe in the submission; do not build now)
- **Garden visits:** visit real friends' gardens and water a wilting garden once a week.
- **Shareable garden postcard:** a snapshot image of the garden, for social sharing.
- **Seasons:** limited seasonal plants each month, with past gardens archived in a herbarium.
- **Real-world payoff:** a 30-day streak funds planting a real tree through a reforestation partner.
- **Habit selection at onboarding,** plus step and sleep data imported from health apps.

---

## 7. Constraints
- Keep it a **single self-contained HTML file** with inline CSS and JavaScript. External scripts may come only from pinned CDN URLs, and fonts only from Google Fonts.
- Do not use `alert()`, `confirm()` or `prompt()`; build confirmations into the page.
- Wrap every `localStorage` read and write in try/catch, and make the app work without storage.
- Preserve the existing visual identity, both themes, mobile-first layout, reduced-motion support and accessibility (visible focus states, button semantics, aria labels).
- Frame nutrition around behaviours, never calorie counts or weight, to avoid encouraging restrictive eating.
- Bump the storage key (for example to `tamanna-garden-v2`) or migrate old state safely.
- Test the full loop before deployment: complete a day, harvest, form a set, skip days to grow weeds and trigger regression, open seed packets, and buy from the market.
- Deploy to a public URL (for example Vercel, Netlify or GitHub Pages) that opens without a login.

---

## 8. Submission description (draft)

*Tamanna is for people who start healthy habits and drop them within a fortnight. It turns everyday choices, such as eating vegetables, walking, sleeping on time and breathing, into a living garden. Each habit earns a specific plant. Blooming plants produce a daily harvest that buys rare seeds. Planting habits from every area of life side by side unlocks bonuses, so the game rewards balance rather than repeating the easiest habit. A missed day brings weeds and wilting. It borrows Duolingo's streaks and leagues and Snapchat's shared streaks, but it replaces the guilt of a broken number with something you build and care for. Built with Claude, which helped with the concept, game design, SVG illustration, code and debugging.*
