// Client-side downscaling before upload, shared by every uploader (review
// photos, avatars, list covers, event covers). Phone photos are 3–12 MB at
// 4000px+, but the app never shows them much wider than 1200 CSS px, so
// uploading them as-is made every visitor download megabytes per photo (a
// 2.8 MB event cover took about a minute on slow 3G).
//
// Run validateImageFile first: this assumes the file is a real image and
// quietly returns the original whenever it can't do better.

/** Longest side for photos and covers. */
export const PHOTO_MAX_SIDE = 1600
/** Longest side for profile pictures (shown at most ~96px, 2–3x density). */
export const AVATAR_MAX_SIDE = 512
const JPEG_QUALITY = 0.82
/** A file this small that already fits is uploaded untouched. */
const SMALL_FILE_BYTES = 300 * 1024

function loadImage(file: File): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null)
    img.onerror = () => resolve(null)
    img.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => {
    try { canvas.toBlob(resolve, type, quality) } catch { resolve(null) }
  })
}

function withExtension(name: string, ext: string): string {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
  return `${base || 'photo'}.${ext}`
}

/**
 * Returns a JPEG copy whose longest side is at most `maxSide`, or the
 * original file when it is a GIF (keeps the animation), is already small,
 * or can't be decoded or re-encoded in this browser.
 */
export async function downscaleImage(
  file: File,
  { maxSide = PHOTO_MAX_SIDE, quality = JPEG_QUALITY }: { maxSide?: number; quality?: number } = {}
): Promise<File> {
  if (file.type === 'image/gif') return file

  const img = await loadImage(file)
  if (!img) return file

  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = Math.min(1, maxSide / longest)
  if (scale === 1 && file.size <= SMALL_FILE_BYTES) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  // JPEG has no transparency: put see-through PNG areas on white, not black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  if (!blob || blob.type !== 'image/jpeg') return file
  // Re-encoding an image that already fits can come out bigger; keep the original then.
  if (scale === 1 && blob.size >= file.size) return file

  return new File([blob], withExtension(file.name, 'jpg'), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

/** "jpg" / "png" / … for a storage path, from the (possibly downscaled) file. */
export function imageExtension(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  if (fromName) return fromName
  const fromType = file.type.split('/')[1]
  return fromType === 'jpeg' ? 'jpg' : fromType || 'jpg'
}
