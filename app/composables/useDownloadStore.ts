const blob = ref<Blob | null>(null)
const filename = ref('')

export function useDownloadStore() {
  function setBlob(data: Blob, name: string) {
    blob.value = data
    filename.value = name
  }

  function clear() {
    blob.value = null
    filename.value = ''
  }

  return {
    blob: readonly(blob),
    filename: readonly(filename),
    setBlob,
    clear
  }
}
