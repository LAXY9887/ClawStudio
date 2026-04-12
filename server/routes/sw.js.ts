/**
 * Dynamic /sw.js route.
 *
 * Serves the Monetag Push Notifications Service Worker when enabled, or a
 * self-unregistering "tombstone" SW when disabled. A single env var toggle
 * (`NUXT_PUBLIC_MONETAG_PUSH_SRC`) controls the whole feature — emptying it
 * disables <head> injection in app.vue AND switches this route to tombstone,
 * which causes already-subscribed browsers to unregister their SW on next fetch.
 *
 * See docs/disabling-monetag-push.md for the full disable procedure.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const adProvider = config.public.adProvider as string
  const pushSrc = config.public.monetagPushSrc as string
  const swDomain = config.public.monetagPushSwDomain as string
  const swZoneId = config.public.monetagPushSwZoneId as string

  const enabled
    = adProvider === 'monetag'
      && !!pushSrc
      && !!swDomain
      && !!swZoneId

  setHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setHeader(event, 'Service-Worker-Allowed', '/')
  // Service workers should never be cached aggressively — browsers already
  // enforce a 24h max on SW script caching, but explicitly tell caches "no".
  setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')

  if (!enabled) {
    // Tombstone SW: unregisters itself the moment a subscribed browser fetches
    // this file again, then reloads any open clients so they re-render without
    // the old SW in control.
    return `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => clients.forEach((c) => c.navigate(c.url)))
})
`
  }

  // Active Monetag Push Notifications SW.
  return `self.options = {
  "domain": "${swDomain}",
  "zoneId": ${swZoneId}
}
self.lary = ""
importScripts('https://${swDomain}/act/files/service-worker.min.js?r=sw')
`
})
