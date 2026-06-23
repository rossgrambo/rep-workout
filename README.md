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

### The algorithm (`js/algorithm.js`)
Three small, swappable functions:

1. **`prescribe(state, exercise)`** — every weight/rep/time is *derived* from the
   primary muscle's strength score. Dumbbell loads snap to weights you actually
   own; barbell loads snap to plate combinations you can actually build;
   bodyweight moves scale reps; cardio scales minutes.

2. **`generatePlan(state, date)`** — picks today's session:
   - Today's **time budget** comes from your per-day hours (0 = rest day).
   - Each selected **goal** contributes a weighting over muscles; they're summed
     into today's priorities.
   - Candidates are filtered to exercises whose equipment you have, then scored
     by `muscle priority × least-recently-used` (so the library rotates).
   - A greedy fill adds exercises until the time budget is spent, **penalizing
     muscles already hit** so the session stays balanced.

3. **`applyResult(state, exId, result)`** — the progression rule from the spec:
   - A **red check** (finished, but you hit failure) is the *target* zone.
   - **2 greens in a row** → the muscle's strength score goes **up** (too easy).
   - **3 reds in a row** → it goes **down** (you're failing out).

Strength scores are seeded from your bodyweight using standard bodyweight-ratio
strength standards (à la ExRx / StrengthLevel), then self-correct from there.

### Adding exercises
Append to the `EXERCISES` array in `js/data.js`. Each entry declares its muscles,
required equipment, load type, and a load multiplier — the algorithm needs no
other changes.

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
