# Rep — a workout app that plans itself

Set your gear, your time, and your goals once. After that, open the app, do the
moves it lists for today, and tap a check on each one. It handles everything
else — what to do, how heavy, and when to make it harder.

It's a **static, installable Progressive Web App**: pure HTML/CSS/JS, no build
step, no backend. Your entire profile lives in one JSON object in
`localStorage`, so it works fully offline and installs to your iOS/Android home
screen.

---

## How it works

### One JSON object is the whole user
Everything about you is one object (see `js/state.js` → `makeDefaultState`):
equipment + owned weights, hours available per day, goals, a **strength score
per muscle**, per-exercise streak counters, and history. The long-term plan is
to let an LLM edit this JSON directly (_"lower my bicep strength"_, _"I keep
running out of time"_). Export/import it any time from **Setup**.

### Motion, not machine
A workout is a **movement** (a motion like "Bent Over Row"), independent of
equipment. Each movement lists the **equipment options** that can perform it
(barbell / dumbbells / curl bar / cable / bodyweight…). The algorithm:

1. Picks a **target load** from the primary muscle's strength score, expressed in
   a single common scale (a "per-limb-equivalent" weight in lb).
2. For each *available* option, computes the **achievable** load and how closely
   it matches the target (`matchError`).
3. Chooses the best match — and **rejects options that can't get close**. This is
   why a barbell with no plates (only a bare 45 lb bar) is skipped in favour of
   dumbbells that actually hit the target, instead of clamping down to 45 lb.

This is also what powers the card popup's **Switch equipment** list (ranked by
match quality).

### The algorithm (`js/algorithm.js`)
Small, swappable functions:

- **`evalOption` / `bestPrescription`** — the motion+equipment matching above.
- **`generatePlan(state, date)`** — today's session: time budget from your per-day
  hours (0 = rest), goal-summed muscle priorities, candidates filtered to what's
  achievable, scored by `muscle priority × least-recently-used`, then a greedy
  fill that **penalizes muscles already hit** so the session stays balanced.
- **`applyResult(state, movementId, result)`** — progression: a **red check**
  (finished, hit failure) is the *target*; **2 greens in a row** → muscle score
  **up**; **3 reds in a row** → **down**.
- **`setBaseline(...)`** — the card popup's *Adjust weight/reps*; your entered
  numbers become the new baseline for that muscle (back-solved into its score).

Strength scores are seeded from your bodyweight using standard bodyweight-ratio
strength standards (à la ExRx / StrengthLevel), then self-correct from there.

### Tapping a card
Tap anywhere on a card (not the checks) to **switch equipment**, **reroll** the
exercise (marks it used-today and swaps in a fresh one), or **adjust weight/reps**
(sets your real baseline — most useful for brand-new users).

### Adding exercises
Append to the `MOVEMENTS` array in `js/data.js`. Each movement declares its
muscles, a `rel` intensity, a rep scheme, and an `options` list of equipment that
can perform it — the algorithm needs no other changes.

---

## Run locally
Any static file server works (a `file://` open won't register the service
worker). For example:

```bash
# Python
python -m http.server 8080
# or Node
npx serve .
```

Then open <http://localhost:8080>.

## Deploy to GitHub Pages
1. Push this folder to a GitHub repo.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick `main` and `/ (root)`.
3. Your app is served at `https://<user>.github.io/<repo>/`.

All paths in this project are **relative**, so it works correctly under that
`/<repo>/` sub-path with no config. The service worker scope is the app folder,
so installability ("Add to Home Screen") works on iOS and Android.

> When you change files, bump the `CACHE` constant in `sw.js` so installed
> clients fetch the new version.

---

## Project layout
```
index.html              app shell + PWA meta tags
manifest.webmanifest    installable-app metadata
sw.js                   offline cache (service worker)
css/styles.css          mobile-first dark UI
icons/                  app icons (SVG + generated PNGs)
js/
  data.js               muscles, equipment, goals, exercise library (content)
  state.js              the single JSON user object + persistence
  algorithm.js          prescribe / generatePlan / applyResult
  ui.js                 all rendering (onboarding, today, stats, setup)
  app.js               controller: state, actions, SW registration
```

## Status / not in v1
- LLM-driven JSON editing (the JSON and export/import hooks are ready for it).
- Real exercise photos/video (cards currently use emoji as lightweight art).
- Cloud sync (data is local-only by design right now).
