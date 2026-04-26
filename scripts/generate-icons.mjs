/**
 * Generates PNG icons for PWA and Apple touch icon from public/icon.svg
 * Run once: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { mkdir } from 'fs/promises'

const svg = readFileSync('./public/icon.svg')

await mkdir('./public/icons', { recursive: true })

// Standard icon sizes
const icons = [
  { size: 192, file: 'icon-192.png' },
  { size: 512, file: 'icon-512.png' },
]

for (const { size, file } of icons) {
  await sharp(svg).resize(size, size).png().toFile(`./public/icons/${file}`)
  console.log(`✓ icons/${file}`)
}

// Apple touch icon — 180x180, no alpha (iOS requires opaque)
await sharp(svg)
  .resize(180, 180)
  .flatten({ background: '#f59e0b' })
  .png()
  .toFile('./public/apple-touch-icon.png')
console.log('✓ apple-touch-icon.png')

// Maskable icons — content padded to 80% safe zone
// Background fills the extra 10% padding on each side
for (const size of [192, 512]) {
  const innerSize = Math.round(size * 0.8)
  const pad = Math.round(size * 0.1)

  const innerBuf = await sharp(svg).resize(innerSize, innerSize).png().toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 245, g: 158, b: 11, alpha: 1 }, // amber-500
    },
  })
    .composite([{ input: innerBuf, top: pad, left: pad }])
    .png()
    .toFile(`./public/icons/icon-maskable-${size}.png`)
  console.log(`✓ icons/icon-maskable-${size}.png`)
}

// OG image placeholder — 1200x630 branded card
await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 4,
    background: { r: 250, g: 250, b: 249, alpha: 1 }, // warmgray-50
  },
})
  .composite([
    {
      input: await sharp(svg).resize(160, 160).png().toBuffer(),
      top: 235,
      left: 520,
    },
  ])
  .png()
  .toFile('./public/og-image.png')
console.log('✓ og-image.png')

console.log('\nAll icons generated.')
