export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.gifServiceUrl}/from-frames`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  const contentType = response.headers.get('content-type') || 'image/gif'
  setResponseHeader(event, 'Content-Type', contentType)
  return new Uint8Array(response._data as ArrayBuffer)
})
