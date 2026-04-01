export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.gifServiceUrl}/to-frames`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  setResponseHeader(event, 'Content-Type', 'application/zip')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="frames.zip"')
  return new Uint8Array(response._data as ArrayBuffer)
})
