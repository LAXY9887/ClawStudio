# Disabling Monetag Push Notifications

Push notifications use a **Service Worker**, which means a simple script removal is not enough — browsers persist SW registrations even after the source file disappears, so already-subscribed users would keep receiving pushes indefinitely. This document explains the correct full-shutdown procedure.

## Architecture — two moving parts

Push notifications only work when **both** of these are in place:

| Component | Location | Job |
|-----------|----------|-----|
| **Tag script** | Injected into `<head>` by [app/app.vue](../app/app.vue) | Prompts user to subscribe and registers the Service Worker in their browser |
| **Service Worker** | Served at `/sw.js` by [server/routes/sw.js.ts](../server/routes/sw.js.ts) | Runs in background, receives push events from Monetag and displays notifications even when the tab is closed |

Emptying the Push src env var turns off the `<head>` injection **and** switches the `/sw.js` route to serve a "tombstone" SW that unregisters itself. Already-subscribed browsers will fetch the tombstone on their next SW update check (browsers force this within 24 hours) and automatically clean up.

## The single toggle

To disable Push Notifications, set **one** environment variable to empty:

```
NUXT_PUBLIC_MONETAG_PUSH_SRC=""
```

That is the whole toggle. Everything else downstream reacts to it:

- `app.vue` skips injecting the `tag.min.js` script — **new visitors never subscribe**
- `/sw.js` server route returns the tombstone SW — **returning subscribers auto-unregister**

## Step-by-step: disabling on Firebase App Hosting

1. Open [apphosting.yaml](../apphosting.yaml) and add the override block:

   ```yaml
   env:
     # ...existing entries...

     # Disable Monetag Push Notifications.
     # - Empties <head> tag.min.js injection in app.vue (no new subscribers)
     # - Flips /sw.js server route to tombstone mode (unregisters old subscribers)
     - variable: NUXT_PUBLIC_MONETAG_PUSH_SRC
       value: ""
       availability:
         - BUILD
         - RUNTIME
   ```

2. Commit and push. Firebase App Hosting will trigger a new build.

3. **Wait up to 24 hours** for already-subscribed browsers to catch up. Browsers check for Service Worker updates on every navigation, but cap the check at 24h maximum, so that is the upper bound for full cleanup. Most active users will unregister within minutes of their next site visit.

4. Verify by opening Chrome DevTools → Application → Service Workers on a previously subscribed browser. After fetching the site, the entry for `/sw.js` should disappear (the tombstone unregistered it).

## Re-enabling later

Delete (or comment out) the `NUXT_PUBLIC_MONETAG_PUSH_SRC` override in `apphosting.yaml` and redeploy. The default value in [nuxt.config.ts](../nuxt.config.ts) kicks back in, `<head>` starts injecting the tag script again, and `/sw.js` returns the live Monetag SW.

No other changes needed — the source of truth (SW domain, zone ID, tag src) is always preserved in `nuxt.config.ts`. The yaml override is purely a runtime switch.

## What about monetag verification?

Monetag originally asked for a `sw.js` file in the site root as a one-time domain ownership check. Once verification is complete, Monetag does **not** re-check the contents of `sw.js` on an ongoing basis. The tombstone version that the server route returns while disabled is still valid JavaScript served at the expected path, so verification remains intact.

If Monetag dashboard ever flags the site as needing re-verification, temporarily re-enable Push (set `NUXT_PUBLIC_MONETAG_PUSH_SRC` back to the default value) and re-run verification, then disable again.

## What NOT to do

- **Do not delete `server/routes/sw.js.ts`.** Without a `/sw.js` endpoint, previously-subscribed browsers will 404 on their SW update check — and some browsers will treat that as "the SW is still valid, keep using the cached copy". The tombstone's job is specifically to tell the browser "unregister me", which requires a valid response.
- **Do not replace the server route with a static file that returns an empty body.** An empty body is still valid JS and does not trigger unregister. The tombstone must actively call `self.registration.unregister()`.
- **Do not assume removing the `<head>` tag script alone is enough.** The tag script only affects new visitors. Existing subscribers need the tombstone to clean themselves up.

## Testing the tombstone locally

You can simulate the disable flow in dev:

1. Start dev server with Push **enabled** (default): `pnpm dev`
2. Visit `http://localhost:3000`, subscribe to notifications when prompted. Chrome DevTools → Application → Service Workers should show `sw.js` as active.
3. Stop the dev server.
4. Create `.env` with `NUXT_PUBLIC_MONETAG_PUSH_SRC=` (empty).
5. Restart `pnpm dev`.
6. Reload the browser tab. The SW should unregister itself on the next navigation and disappear from DevTools.
