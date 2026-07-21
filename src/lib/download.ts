export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  // Firefox ignores click() on anchors that are not mounted in the DOM.
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
