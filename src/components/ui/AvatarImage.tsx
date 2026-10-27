import { useEffect, useState, type ReactNode } from 'react'

// Avatar URLs are user-controlled profile data, so they can be stale, junk
// or unreachable (prod has one set to https://localhost). Render the image
// when it loads; otherwise fall back to whatever the caller already renders
// for "no avatar" (usually initials) instead of a broken-image icon.
export function isUsableImageUrl(src: string | null | undefined): src is string {
  if (!src) return false
  if (src.startsWith('blob:') || src.startsWith('data:image/')) return true
  try {
    const u = new URL(src)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname) && u.hostname !== window.location.hostname) return false
    return true
  } catch {
    return false
  }
}

interface Props {
  src: string | null | undefined
  alt: string
  className?: string
  fallback: ReactNode
}

export default function AvatarImage({ src, alt, className, fallback }: Props) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  if (failed || !isUsableImageUrl(src)) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />
}
