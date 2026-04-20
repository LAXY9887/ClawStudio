export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.png2ssServiceUrl}/split-spritesheet`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  const contentType = response.headers.get('content-type') || 'application/zip'
  setResponseHeader(event, 'Content-Type', contentType)
  if (contentType.includes('zip')) {
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="split.zip"')
  } else if (contentType.includes('json')) {
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="atlas.json"')
  } else if (contentType.includes('css')) {
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="atlas.css"')
  }
  return new Uint8Array(response._data as ArrayBuffer)
})
