export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.png2ssServiceUrl}/trim`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  const contentType = response.headers.get('content-type') || 'image/png'
  setResponseHeader(event, 'Content-Type', contentType)
  if (contentType.includes('zip')) {
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="trimmed.zip"')
  }
  return new Uint8Array(response._data as ArrayBuffer)
})
