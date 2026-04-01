export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.gifServiceUrl}/to-spritesheet`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  setResponseHeader(event, 'Content-Type', response.headers.get('content-type') || 'image/png')
  return new Uint8Array(response._data as ArrayBuffer)
})
