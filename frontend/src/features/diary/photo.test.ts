// Reglas de la foto en el dispositivo (spec 025): validación, tamaño y
// preparación del JPEG que se envía. El navegador (decodificar y canvas) se
// sustituye por FakePhotoProcessor, que no es el navegador real: la orientación
// EXIF y HEIC se prueban aquí como regla y, además, a mano en un navegador.
import { describe, expect, it } from "vitest"
import { FakePhotoProcessor, makePhotoFile } from "@/test/photoFixtures"
import {
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BYTES,
  PHOTO_SIZE_MESSAGE,
  PHOTO_TYPE_MESSAGE,
  PhotoReadError,
  UploadTooLargeError,
  checkPhotoReadable,
  photoFileError,
  preparePhotoUpload,
  scaledSize,
} from "./photo"

const MB = 1024 * 1024

describe("photoFileError", () => {
  // SDD: 025 REQ-003 AC-003.1
  it.each([
    ["un PDF", "documento.pdf", "application/pdf"],
    ["un GIF", "animacion.gif", "image/gif"],
  ])("rechaza %s con el mensaje de tipo", (_name, name, type) => {
    expect(photoFileError(makePhotoFile({ name, type }))).toBe(PHOTO_TYPE_MESSAGE)
    expect(PHOTO_TYPE_MESSAGE).toBe("Elige una foto JPEG, PNG, WebP o HEIC.")
  })

  // SDD: 025 REQ-003 AC-003.1
  it.each([
    ["JPEG", "a.jpg", "image/jpeg"],
    ["PNG", "a.png", "image/png"],
    ["WebP", "a.webp", "image/webp"],
    ["HEIC", "a.heic", "image/heic"],
    ["HEIF", "a.heif", "image/heif"],
  ])("acepta una foto %s", (_name, name, type) => {
    expect(photoFileError(makePhotoFile({ name, type }))).toBeNull()
  })

  // SDD: 025 REQ-003 AC-003.1
  it.each(["foto.heic", "FOTO.HEIF", "foto.jpg", "foto.jpeg", "foto.png", "foto.webp"])(
    "con el tipo vacío acepta %s por su extensión",
    (name) => {
      expect(photoFileError(makePhotoFile({ name, type: "" }))).toBeNull()
    }
  )

  // SDD: 025 REQ-003 AC-003.1
  it("con el tipo vacío y una extensión que no es de imagen la rechaza", () => {
    expect(photoFileError(makePhotoFile({ name: "notas.txt", type: "" }))).toBe(
      PHOTO_TYPE_MESSAGE
    )
  })

  // SDD: 025 REQ-003 AC-003.2
  it("acepta una foto de exactamente 20 MB", () => {
    expect(MAX_PHOTO_BYTES).toBe(20 * MB)
    expect(photoFileError(makePhotoFile({ bytes: 20 * MB }))).toBeNull()
  })

  // SDD: 025 REQ-003 AC-003.2
  it("rechaza una foto de 20 MB y un byte con el mensaje de tamaño", () => {
    expect(photoFileError(makePhotoFile({ bytes: 20 * MB + 1 }))).toBe(PHOTO_SIZE_MESSAGE)
    expect(PHOTO_SIZE_MESSAGE).toBe("La foto no puede superar los 20 MB.")
  })

  // SDD: 025 REQ-003 AC-003.2
  it("comprueba el tipo antes que el tamaño", () => {
    expect(
      photoFileError(makePhotoFile({ name: "doc.pdf", type: "application/pdf", bytes: 30 * MB }))
    ).toBe(PHOTO_TYPE_MESSAGE)
  })
})

describe("checkPhotoReadable", () => {
  // SDD: 025 REQ-003 AC-003.3
  it("lee la foto una vez con el procesador cuando se puede leer", async () => {
    const processor = new FakePhotoProcessor()
    const file = makePhotoFile()

    await expect(checkPhotoReadable(file, processor)).resolves.toBeUndefined()

    expect(processor.readCalls).toEqual([file])
  })

  // SDD: 025 REQ-003 AC-003.3
  it("propaga PhotoReadError cuando el navegador no puede leer la foto", async () => {
    const processor = new FakePhotoProcessor({ unreadable: true })

    await expect(checkPhotoReadable(makePhotoFile(), processor)).rejects.toBeInstanceOf(
      PhotoReadError
    )
  })
})

describe("scaledSize", () => {
  // SDD: 025 REQ-004 AC-004.1
  it("reduce 4000×3000 a 1600×1200 conservando la proporción", () => {
    expect(scaledSize({ width: 4000, height: 3000 })).toEqual({ width: 1600, height: 1200 })
  })

  // SDD: 025 REQ-004 AC-004.2
  it("no agranda una foto de 800×600", () => {
    expect(scaledSize({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
  })

  // SDD: 025 REQ-004 AC-004.2
  it("deja igual una foto cuyo lado mayor es exactamente 1600", () => {
    expect(scaledSize({ width: 1600, height: 1600 })).toEqual({ width: 1600, height: 1600 })
  })

  // SDD: 025 REQ-004 AC-004.3
  it("reduce una foto vertical de 3000×4000 a 1200×1600", () => {
    expect(scaledSize({ width: 3000, height: 4000 })).toEqual({ width: 1200, height: 1600 })
  })

  // SDD: 025 REQ-004 AC-004.1
  it("usa el lado mayor indicado cuando se pasa", () => {
    expect(scaledSize({ width: 4000, height: 3000 }, 800)).toEqual({ width: 800, height: 600 })
  })

  // SDD: 025 REQ-004 AC-004.1
  it("redondea y nunca devuelve un lado menor que 1", () => {
    expect(scaledSize({ width: 10000, height: 1 })).toEqual({ width: 1600, height: 1 })
  })
})

describe("preparePhotoUpload", () => {
  // SDD: 025 REQ-004 AC-004.1
  it("una foto JPEG de 4000×3000 se dibuja a 1600×1200 y sale un JPEG", async () => {
    const processor = new FakePhotoProcessor({ size: { width: 4000, height: 3000 } })

    const blob = await preparePhotoUpload(makePhotoFile(), processor)

    expect(processor.jpegCalls).toEqual([{ width: 1600, height: 1200 }])
    expect(blob.type).toBe("image/jpeg")
  })

  // SDD: 025 REQ-004 AC-004.2
  it("una foto PNG de 800×600 se envía a 800×600 como JPEG", async () => {
    const processor = new FakePhotoProcessor({ size: { width: 800, height: 600 } })

    const blob = await preparePhotoUpload(
      makePhotoFile({ name: "plato.png", type: "image/png" }),
      processor
    )

    expect(processor.jpegCalls).toEqual([{ width: 800, height: 600 }])
    expect(blob.type).toBe("image/jpeg")
  })

  // SDD: 025 REQ-004 AC-004.3
  it("con la orientación ya aplicada (3000×4000) la imagen sale de 1200×1600", async () => {
    // Una foto guardada en 4000×3000 con EXIF 6 la decodifica el navegador ya
    // girada: el procesador devuelve el tamaño orientado.
    const processor = new FakePhotoProcessor({ size: { width: 3000, height: 4000 } })

    await preparePhotoUpload(makePhotoFile(), processor)

    expect(processor.jpegCalls).toEqual([{ width: 1200, height: 1600 }])
  })

  // SDD: 025 REQ-004 AC-004.4
  it("una foto HEIC que el navegador sabe leer sale como JPEG", async () => {
    const processor = new FakePhotoProcessor()

    const blob = await preparePhotoUpload(
      makePhotoFile({ name: "iphone.heic", type: "image/heic" }),
      processor
    )

    expect(blob.type).toBe("image/jpeg")
    expect(processor.jpegCalls).toHaveLength(1)
  })

  // SDD: 025 REQ-004 AC-004.5
  it("acepta un JPEG de exactamente 3 MB", async () => {
    expect(MAX_UPLOAD_BYTES).toBe(3 * MB)
    const processor = new FakePhotoProcessor({ jpegBytes: 3 * MB })

    const blob = await preparePhotoUpload(makePhotoFile(), processor)

    expect(blob.size).toBe(3 * MB)
  })

  // SDD: 025 REQ-004 AC-004.5
  it("lanza UploadTooLargeError si el JPEG supera los 3 MB", async () => {
    const processor = new FakePhotoProcessor({ jpegBytes: 3 * MB + 1 })

    await expect(preparePhotoUpload(makePhotoFile(), processor)).rejects.toBeInstanceOf(
      UploadTooLargeError
    )
  })

  // SDD: 025 REQ-003 AC-003.3
  it("propaga PhotoReadError si el navegador no puede leer la foto", async () => {
    const processor = new FakePhotoProcessor({ unreadable: true })

    await expect(preparePhotoUpload(makePhotoFile(), processor)).rejects.toBeInstanceOf(
      PhotoReadError
    )
  })
})
