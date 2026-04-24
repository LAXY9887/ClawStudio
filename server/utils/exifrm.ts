import type { H3Event } from 'h3'

export async function proxyExifrm(event: H3Event, path: string, isScan: boolean) {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

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
}
