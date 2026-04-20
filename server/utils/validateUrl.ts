const BLOCKED_PATTERNS = [
  // Link-local / GCP & AWS metadata service
  /^https?:\/\/169\.254\./i,
  // Loopback
  /^https?:\/\/(localhost|127\.)/i,
  // RFC 1918 private ranges
  /^https?:\/\/10\./i,
  /^https?:\/\/192\.168\./i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./i,
  // GCP metadata domain
  /^https?:\/\/metadata\.google(\.internal)?/i
]

export function validateRemoteUrl(url: string | null | undefined): void {
  if (!url) return

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw createError({ statusCode: 422, statusMessage: 'URL must start with http:// or https://' })
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(url)) {
      throw createError({ statusCode: 422, statusMessage: 'URL not allowed' })
    }
  }
}
