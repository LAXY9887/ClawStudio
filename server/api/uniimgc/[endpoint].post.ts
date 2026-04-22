const ALLOWED_ENDPOINTS = new Set([
  'heic',
  'avif',
  'webp',
  'png-to-jpg',
  'jpg-to-png',
  'svg-to-png',
  'favicon'
])

export default defineEventHandler(async (event) => {
  const endpoint = getRouterParam(event, 'endpoint')
  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown endpoint' })
  }

  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.uniimgcServiceUrl}/${endpoint}`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  setResponseHeader(event, 'Content-Type', contentType)

  if (contentType.includes('zip')) {
    const filename = endpoint === 'favicon' ? 'favicon-pack.zip' : 'converted.zip'
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  }

  return new Uint8Array(response._data as ArrayBuffer)
})
