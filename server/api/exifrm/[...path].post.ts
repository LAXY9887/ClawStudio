const ALLOWED_PATHS = new Set([
  'scan',
  'clean',
  'batch/scan',
  'batch/clean'
])

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')
  if (!path || !ALLOWED_PATHS.has(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown endpoint' })
  }

  const config = useRuntimeConfig()
  const formData = await readFormData(event)
  const isScan = path === 'scan' || path === 'batch/scan'

  const response = await $fetch.raw(`${config.exifrmServiceUrl}/${path}`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: isScan ? 'json' : 'arrayBuffer'
  })

  if (isScan) {
    return response._data
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  setResponseHeader(event, 'Content-Type', contentType)

  const disposition = response.headers.get('content-disposition')
  if (disposition) {
    setResponseHeader(event, 'Content-Disposition', disposition)
  } else if (path === 'batch/clean') {
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="cleaned.zip"')
  }

  return new Uint8Array(response._data as ArrayBuffer)
})
