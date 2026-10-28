import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AVATAR_MAX_SIDE, downscaleImage, imageExtension } from './imageResize'

// jsdom can't decode images or draw on a canvas, so fake both: the "decoded"
// size comes from `nextSize`, and toBlob returns `encodedBytes` of JPEG.
let nextSize: { w: number; h: number } | null = { w: 4000, h: 3000 }
let encodedBytes = 200 * 1024
const drawn: { w: number; h: number }[] = []

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  set src(_url: string) {
    setTimeout(() => {
      if (!nextSize) { this.onerror?.(); return }
      this.naturalWidth = nextSize.w
      this.naturalHeight = nextSize.h
      this.onload?.()
    })
  }
}

function fakeFile(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

beforeEach(() => {
  nextSize = { w: 4000, h: 3000 }
  encodedBytes = 200 * 1024
  drawn.length = 0
  vi.stubGlobal('Image', FakeImage)
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const canvas = this
    return {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: () => { drawn.push({ w: canvas.width, h: canvas.height }) },
    } as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => {
    cb(new Blob([new Uint8Array(encodedBytes)], { type: type ?? 'image/png' }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('downscaleImage', () => {
  it('shrinks a big phone photo to 1600px on the longest side as JPEG', async () => {
    const out = await downscaleImage(fakeFile('IMG_1234.HEIC.png', 'image/png', 6 * 1024 * 1024))
    expect(drawn).toEqual([{ w: 1600, h: 1200 }])
    expect(out.type).toBe('image/jpeg')
    expect(out.name).toBe('IMG_1234.HEIC.jpg')
    expect(out.size).toBe(encodedBytes)
  })

  it('uses the longest side for tall photos, and 512px for avatars', async () => {
    nextSize = { w: 3000, h: 4000 }
    await downscaleImage(fakeFile('tall.jpg', 'image/jpeg', 3 * 1024 * 1024))
    nextSize = { w: 3000, h: 4000 }
    await downscaleImage(fakeFile('me.jpg', 'image/jpeg', 3 * 1024 * 1024), { maxSide: AVATAR_MAX_SIDE })
    expect(drawn).toEqual([{ w: 1200, h: 1600 }, { w: 384, h: 512 }])
  })

  it('keeps GIFs as they are (animation)', async () => {
    const gif = fakeFile('dance.gif', 'image/gif', 4 * 1024 * 1024)
    expect(await downscaleImage(gif)).toBe(gif)
    expect(drawn).toEqual([])
  })

  it('skips a small file that already fits', async () => {
    nextSize = { w: 1200, h: 900 }
    const small = fakeFile('small.jpg', 'image/jpeg', 150 * 1024)
    expect(await downscaleImage(small)).toBe(small)
    expect(drawn).toEqual([])
  })

  it('re-encodes a heavy file that fits (e.g. a 2.8 MB PNG cover) but never makes it bigger', async () => {
    nextSize = { w: 1254, h: 1254 }
    const png = fakeFile('cover.png', 'image/png', 2_800_000)
    const out = await downscaleImage(png)
    expect(out).not.toBe(png)
    expect(out.type).toBe('image/jpeg')
    expect(drawn).toEqual([{ w: 1254, h: 1254 }])

    nextSize = { w: 1000, h: 800 }
    encodedBytes = 900 * 1024
    const tight = fakeFile('tight.jpg', 'image/jpeg', 400 * 1024)
    expect(await downscaleImage(tight)).toBe(tight)
  })

  it('returns the original when the browser can’t decode it', async () => {
    nextSize = null
    const heic = fakeFile('photo.heic', 'image/heic', 3 * 1024 * 1024)
    expect(await downscaleImage(heic)).toBe(heic)
  })
})

describe('imageExtension', () => {
  it('takes the extension from the name, else the type', () => {
    expect(imageExtension(fakeFile('a.JPG', 'image/jpeg', 1))).toBe('jpg')
    expect(imageExtension(fakeFile('noext', 'image/jpeg', 1))).toBe('jpg')
    expect(imageExtension(fakeFile('noext', 'image/webp', 1))).toBe('webp')
  })
})
