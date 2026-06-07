// Processamento de imagem de avatar — recorte central quadrado + resize p/ 256px JPEG.
// Extraído de pages/Configuracoes.jsx (depende de DOM: FileReader/Image/Canvas).

/** Lê um arquivo de imagem, recorta no centro (quadrado) e redimensiona p/ 256px JPEG. */
export async function fileToAvatarDataUrl(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const min = Math.min(img.width, img.height)
  const sx = (img.width - min) / 2
  const sy = (img.height - min) / 2
  ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.82)
}
