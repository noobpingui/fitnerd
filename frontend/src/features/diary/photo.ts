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

export function photoFileError(_file: File): string | null {
  throw new Error("not implemented")
}

export function scaledSize(_size: PhotoSize, _maxSide?: number): PhotoSize {
  throw new Error("not implemented")
}

export async function checkPhotoReadable(_file: File, _processor: PhotoProcessor): Promise<void> {
  throw new Error("not implemented")
}

export async function preparePhotoUpload(_file: File, _processor: PhotoProcessor): Promise<Blob> {
  throw new Error("not implemented")
}

export const browserPhotoProcessor: PhotoProcessor = {
  readSize(_file) {
    throw new Error("not implemented")
  },
  toJpeg(_file, _size) {
    throw new Error("not implemented")
  },
  createPreviewUrl(_file) {
    throw new Error("not implemented")
  },
  revokePreviewUrl(_url) {
    throw new Error("not implemented")
  },
}
