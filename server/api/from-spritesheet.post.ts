export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)
  validateRemoteUrl(formData.get('url') as string | null)

  const response = await $fetch.raw(`${config.gifServiceUrl}/from-spritesheet`, {
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
