/**
 * Dynamic /sw.js route — permanent tombstone.
 *
 * Always serves a self-unregistering Service Worker. Any previously subscribed
 * browsers will fetch this file within 24h and automatically unregister the old
 * SW, then reload open tabs.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setHeader(event, 'Service-Worker-Allowed', '/')
  setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')

  return `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => clients.forEach((c) => c.navigate(c.url)))
})
`
})
