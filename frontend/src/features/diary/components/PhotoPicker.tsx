import { useRef, type ChangeEvent, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { PHOTO_ACCEPT } from "../photo"

// Botones «Hacer una foto» y «Elegir una foto» con sus selectores de archivo ocultos.
export function PhotoPicker({
  onPick,
  disabled = false,
}: {
  onPick: (file: File) => void
  disabled?: boolean
}): ReactElement {
  const cameraRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Se vacía para poder elegir la misma foto otra vez.
    event.target.value = ""
    if (file) onPick(file)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
      >
        Hacer una foto
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => filesRef.current?.click()}
      >
        Elegir una foto
      </Button>
      <input
        ref={cameraRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="meal-photo-camera-input"
        onChange={handleChange}
      />
      <input
        ref={filesRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="meal-photo-file-input"
        onChange={handleChange}
      />
    </div>
  )
}
