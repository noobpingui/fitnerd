// Dobles de prueba de la spec 025 (registro de una comida con foto): un
// procesador de fotos escrito a mano que sustituye al navegador (decodificar,
// canvas y URLs blob:, que jsdom no puede ejecutar) y una fábrica de archivos.
import {
  PhotoReadError,
  type PhotoProcessor,
  type PhotoSize,
} from "@/features/diary/photo"

type FakePhotoProcessorOptions = {
  // Tamaño (ya orientado) que "decodifica" el doble.
  size?: PhotoSize
  // Si es true, readSize y toJpeg lanzan PhotoReadError.
  unreadable?: boolean
  // Tamaño en bytes del JPEG que devuelve toJpeg.
  jpegBytes?: number
}

export class FakePhotoProcessor implements PhotoProcessor {
  readCalls: Blob[] = []
  jpegCalls: PhotoSize[] = []
  created: string[] = []
  revoked: string[] = []

  size: PhotoSize
  unreadable: boolean
  jpegBytes: number

  constructor({ size, unreadable, jpegBytes }: FakePhotoProcessorOptions = {}) {
    this.size = size ?? { width: 1200, height: 900 }
    this.unreadable = unreadable ?? false
    this.jpegBytes = jpegBytes ?? 1024
  }

  async readSize(file: Blob): Promise<PhotoSize> {
    this.readCalls.push(file)
    if (this.unreadable) throw new PhotoReadError("no se puede leer")
    return this.size
  }

  async toJpeg(_file: Blob, size: PhotoSize): Promise<Blob> {
    this.jpegCalls.push(size)
    if (this.unreadable) throw new PhotoReadError("no se puede leer")
    return new Blob([new Uint8Array(this.jpegBytes)], { type: "image/jpeg" })
  }

  createPreviewUrl(_file: Blob): string {
    const url = `blob:preview-${this.created.length + 1}`
    this.created.push(url)
    return url
  }

  revokePreviewUrl(url: string): void {
    this.revoked.push(url)
  }
}

// Un File con el tamaño indicado sin reservar esa memoria (20 MB en un test).
export function makePhotoFile({
  name = "comida.jpg",
  type = "image/jpeg",
  bytes = 2048,
}: { name?: string; type?: string; bytes?: number } = {}): File {
  const file = new File(["contenido"], name, { type })
  Object.defineProperty(file, "size", { value: bytes })
  return file
}
