// Client-side image checks shared by every uploader (review photos, avatars).
// MIME type and extension are just labels the browser derives from the file
// name, so a renamed random-bytes file passes them. Actually decoding the
// image is the only cheap way to know it will render.

export const MAX_IMAGE_MB = 15

export async function canDecodeImage(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<boolean>(resolve => {
      const img = new Image()
      img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0)
      img.onerror = () => resolve(false)
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Returns a user-facing error message, or null when the file is a usable image.
export async function validateImageFile(file: File, maxMb = MAX_IMAGE_MB): Promise<string | null> {
  if (!file.type.startsWith('image/')) return `"${file.name}" isn't a photo. Choose a JPG, PNG, WebP or GIF.`
  if (file.size > maxMb * 1024 * 1024) return `"${file.name}" is too big. Photos must be under ${maxMb} MB.`
  if (!(await canDecodeImage(file))) return `"${file.name}" can't be opened as a photo. It may be damaged. Try a different file.`
  return null
}
