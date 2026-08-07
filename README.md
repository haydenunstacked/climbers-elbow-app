# Climber's elbow

A phone app that answers one question. What elbow rehab am I doing today, given whether I am climbing.

Derived from the canonical note in my vault at `02 Personal notes/Climbers elbow rehab protocol.md`. **That note is the source of truth.** If the protocol changes there, change `js/protocol.js` to match.

## What it does

Asks whether today is a climbing day, then gives you the right session.

- **Climbing** gives the daily core only, three exercises, with a reminder to do it after you climb rather than before.
- **Not climbing** adds the extra block, six exercises, and counts toward the target of three extra blocks a week.
- **Flare day** swaps the eccentrics for the two isometric options when the elbow is angry.

Each exercise shows its diagram, the dose, and a tempo timer where there is one. The 4 second lower and the 45 second isometric are the ones that matter.

## What it deliberately does not do

No pain logging, no morning check-ins, no rule engine, no charts, no export. All of that was designed and then cut, on purpose. The pain rule survives as printed text on the finish screen because it is the one judgment the app cannot make for you.

No accounts, no sync, no server, no notifications.

## Running it

```
npm run serve      # http://localhost:8080
npm test           # 36 unit tests, stamps the cache version first
npm run build      # regenerate diagrams, icons, cache version and the bundle
npm run bundle     # just the single-file build
```

The app is plain HTML, CSS and ES modules. There is no build step for the app itself. The `build/` scripts only generate assets.

It needs to be served over http, not opened as a file. Modules and service workers both require an origin, and Safari throws on `localStorage` from `file://`.

## Layout

```
index.html            shell
styles.css            everything visual, light and dark
js/protocol.js        exercise data, mirrors the vault note. pure
js/scheduler.js       decides today's session. pure
js/store.js           localStorage, falls back to memory if blocked
js/app.js             screens, timers, DOM
sw.js                 cache-first service worker
diagrams/             18 single-panel SVGs, generated
build/                asset generation, not shipped
test/                 node --test, no dependencies
```

`protocol.js` and `scheduler.js` are pure and fully unit tested. `store.js` and `app.js` were verified by driving the real app in a browser at iPhone 14 Pro size.

## Diagrams

The vault note has eight landscape diagrams drawn for a laptop. `build/split-panels.mjs` slices them into 18 single-panel SVGs that fill a phone screen, so you swipe through the steps instead of squinting at a strip.

Regenerate with `npm run diagrams` after editing anything in `build/*.svg`. The source diagrams there are copies. The originals live in the vault.

## The cache version matters

`sw.js` caches everything so the app works offline in a gym with no signal. The cache name includes a hash of every precached file, stamped by `build/stamp-version.mjs`.

**Run `npm run stamp` before every deploy.** Without it the cache name never changes, the service worker keeps serving the old files, and an update never reaches the phone. `npm test` runs it automatically so it is hard to forget.

`test/precache.test.js` fails if a shipped file is missing from the precache list, which is the other way offline silently breaks.

## Deploying

Push to `main`. `.github/workflows/pages.yml` runs the suite, refuses to deploy if the cache version is stale, and publishes to Pages.

First time only, after `gh auth login`:

```
gh repo create climbers-elbow-app --public --source=. --push
gh api -X POST repos/:owner/climbers-elbow-app/pages -f build_type=workflow
```

## The single-file bundle

`npm run bundle` produces `dist/elbow-standalone.html`, the entire app in one file with the CSS inlined, the modules concatenated and all 18 diagrams embedded as data URIs. About 91 KB.

It is a fallback, not the main path. It has no service worker, so offline depends on the browser's own cache rather than being guaranteed. Useful for dropping on any host without a build step, or as a durable copy.

It still needs to be served over http. A single file does not get around Safari's `file://` restrictions.

## Installing on the phone

Open the URL in Safari, Share, Add to Home Screen. After the first load the service worker has everything and it runs with no signal.

iOS evicts storage from web apps you have not opened in a while. The only thing that can be lost is the count of extra blocks in the current week, which resets every Monday anyway. Nothing worth backing up.
