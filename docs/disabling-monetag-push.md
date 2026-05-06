# Disabling Monetag Push Notifications (Historical — Monetag removed 2026-05-04)

> **Note:** Monetag has been fully removed from ClawStudio. The `/sw.js` route now permanently serves a tombstone Service Worker that unregisters any previously subscribed browsers. This document is kept for historical reference only.

---

Push notifications use a **Service Worker**, which means a simple script removal is not enough — browsers persist SW registrations even after the source file disappears, so already-subscribed users would keep receiving pushes indefinitely. This document explains the correct full-shutdown procedure.

## Architecture — two moving parts

Push notifications only work when **both** of these are in place:

| Component | Location | Job |
|-----------|----------|-----|
| **Tag script** | Injected into `<head>` by [app/app.vue](../app/app.vue) | Prompts user to subscribe and registers the Service Worker in their browser |
| **Service Worker** | Served at `/sw.js` by [server/routes/sw.js.ts](../server/routes/sw.js.ts) | Runs in background, receives push events from Monetag and displays notifications even when the tab is closed |

Emptying the Push src env var turns off the `<head>` injection **and** switches the `/sw.js` route to serve a "tombstone" SW that unregisters itself. Already-subscribed browsers will fetch the tombstone on their next SW update check (browsers force this within 24 hours) and automatically clean up.

## The single toggle

To disable Push Notifications, set **one** environment variable to any non-URL string (e.g. `disabled`):

```
NUXT_PUBLIC_MONETAG_PUSH_SRC=disabled
```

That is the whole toggle. Everything else downstream reacts to it:

- `app.vue` skips injecting the `tag.min.js` script (the `isValidAdScriptSrc()` guard rejects any value that does not start with `http://` or `https://`) — **new visitors never subscribe**
- `/sw.js` server route returns the tombstone SW — **returning subscribers auto-unregister**

**Note**: Firebase App Hosting's `apphosting.yaml` schema does **not** accept empty string values, so you cannot use `value: ""`. Use a sentinel string like `disabled` instead.

## Step-by-step: disabling on Firebase App Hosting

1. Open [apphosting.yaml](../apphosting.yaml) and add the override block:

   ```yaml
   env:
     # ...existing entries...

     # Disable Monetag Push Notifications.
     # - Skips <head> tag.min.js injection in app.vue (no new subscribers)
     # - Flips /sw.js server route to tombstone mode (unregisters old subscribers)
     # Any non-URL string works as a disable sentinel; "disabled" is idiomatic.
     - variable: NUXT_PUBLIC_MONETAG_PUSH_SRC
       value: disabled
       availability:
         - BUILD
         - RUNTIME
   ```

2. Commit and push. Firebase App Hosting will trigger a new build.

3. **Wait up to 24 hours** for already-subscribed browsers to catch up. Browsers check for Service Worker updates on every navigation, but cap the check at 24h maximum, so that is the upper bound for full cleanup. Most active users will unregister within minutes of their next site visit.

4. Verify by opening Chrome DevTools → Application → Service Workers on a previously subscribed browser. After fetching the site, the entry for `/sw.js` should disappear (the tombstone unregistered it).

## Re-enabling later

> **不建議重新啟用。** Monetag 已從 ClawStudio 的廣告策略中**永久棄用**——詳見 [ad-networks-comparison.md](./ad-networks-comparison.md) 的棄用警示。本節保留僅供歷史參考，不應作為操作指引。

如果有特殊歷史驗證需求，可刪除（或註解）`apphosting.yaml` 中的 `NUXT_PUBLIC_MONETAG_PUSH_SRC` override，並重新部署。但這應該屬於極少見的情況，預設行為應該是維持目前的關閉狀態。

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
