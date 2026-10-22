export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024
export const MAX_UPLOAD_SIDE = 1600
export const JPEG_QUALITY = 0.85
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
export const PHOTO_TYPE_MESSAGE = "Elige una foto JPEG, PNG, WebP o HEIC."
export const PHOTO_SIZE_MESSAGE = "La foto no puede superar los 20 MB."
export const PHOTO_UNREADABLE_MESSAGE =
  "No se pudo leer la foto. Prueba con otra foto en JPEG, PNG o WebP."
export const UPLOAD_TOO_LARGE_MESSAGE = "La imagen no puede superar los 3 MB."

export type PhotoSize = { width: number; height: number }
export interface PhotoProcessor {
  // Decodifica la foto con la orientación aplicada; lanza PhotoReadError si no se puede leer.
  readSize(file: Blob): Promise<PhotoSize>
  // Dibuja la foto orientada al tamaño dado y la codifica en JPEG; lanza PhotoReadError si falla.
  toJpeg(file: Blob, size: PhotoSize): Promise<Blob>
  createPreviewUrl(file: Blob): string
  revokePreviewUrl(url: string): void
}
export class PhotoReadError extends Error {}
export class UploadTooLargeError extends Error {}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]

// Tipo (MIME o, si viene vacío, extensión) y después tamaño. No lee el contenido.
export function photoFileError(file: File): string | null {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  const typeOk =
    type === ""
      ? ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))
      : ALLOWED_TYPES.includes(type)
  if (!typeOk) return PHOTO_TYPE_MESSAGE
  if (file.size > MAX_PHOTO_BYTES) return PHOTO_SIZE_MESSAGE
  return null
}

// Lado mayor ≤ maxSide conservando la proporción; nunca agranda.
export function scaledSize(size: PhotoSize, maxSide: number = MAX_UPLOAD_SIDE): PhotoSize {
  const longest = Math.max(size.width, size.height)
  if (longest <= maxSide) return { width: size.width, height: size.height }
  const factor = maxSide / longest
  return {
    width: Math.max(1, Math.round(size.width * factor)),
    height: Math.max(1, Math.round(size.height * factor)),
  }
}

export async function checkPhotoReadable(file: File, processor: PhotoProcessor): Promise<void> {
  await processor.readSize(file)
}

export async function preparePhotoUpload(file: File, processor: PhotoProcessor): Promise<Blob> {
  const size = scaledSize(await processor.readSize(file))
  const jpeg = await processor.toJpeg(file, size)
  if (jpeg.size > MAX_UPLOAD_BYTES) throw new UploadTooLargeError(UPLOAD_TOO_LARGE_MESSAGE)
  return jpeg
}

// Decodifica con un HTMLImageElement desde una URL blob: que se revoca al terminar.
// El navegador aplica la orientación EXIF al decodificar y al dibujar.
async function decodeImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } catch {
    throw new PhotoReadError(PHOTO_UNREADABLE_MESSAGE)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const browserPhotoProcessor: PhotoProcessor = {
  async readSize(file) {
    const image = await decodeImage(file)
    return { width: image.naturalWidth, height: image.naturalHeight }
  },
  async toJpeg(file, size) {
    const image = await decodeImage(file)
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext("2d")
    if (!context) throw new PhotoReadError(PHOTO_UNREADABLE_MESSAGE)
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, size.width, size.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    )
    if (!blob) throw new PhotoReadError(PHOTO_UNREADABLE_MESSAGE)
    return blob
  },
  createPreviewUrl(file) {
    return URL.createObjectURL(file)
  },
  revokePreviewUrl(url) {
    URL.revokeObjectURL(url)
  },
}
