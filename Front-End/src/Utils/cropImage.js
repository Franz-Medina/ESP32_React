const createImage = (imageSrc) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = imageSrc
  })

export const getCroppedImageDataUrl = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc)

  const size = Math.min(pixelCrop.width, pixelCrop.height)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas context is not available.')
  }

  canvas.width = size
  canvas.height = size

  context.save()
  context.beginPath()
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  context.closePath()
  context.clip()

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  )

  context.restore()

  return canvas.toDataURL('image/png', 1)
}