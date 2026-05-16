/**
 * Gera os 4 ícones PWA corretos a partir de public/icons/pwa-app-icon.png:
 *   pwa-192.png         — 192x192, purpose: any
 *   pwa-512.png         — 512x512, purpose: any
 *   pwa-192-maskable.png — 192x192, purpose: maskable (icon ocupa 60% central, fundo branco)
 *   pwa-512-maskable.png — 512x512, purpose: maskable
 *
 * Execução: node scripts/gen-pwa-icons.mjs
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const src = join(root, 'public', 'icons', 'pwa-app-icon.png')
const out = join(root, 'public', 'icons')

async function generate(size, maskable) {
  const filename = maskable ? `pwa-${size}-maskable.png` : `pwa-${size}.png`
  const dest = join(out, filename)

  if (maskable) {
    /* Maskable: ícone ocupa 60% central (safe zone), fundo #ffffff */
    const iconSize = Math.round(size * 0.6)
    const padding = Math.round((size - iconSize) / 2)
    const iconBuf = await sharp(src).resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer()
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{ input: iconBuf, top: padding, left: padding }])
      .png()
      .toFile(dest)
  } else {
    await sharp(src).resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toFile(dest)
  }

  console.log('gerado:', filename)
}

await generate(192, false)
await generate(512, false)
await generate(192, true)
await generate(512, true)
console.log('Ícones PWA gerados em public/icons/')
