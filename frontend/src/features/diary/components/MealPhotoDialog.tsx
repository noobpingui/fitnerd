import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NO_FOODS_MESSAGE, analysisErrorView, saveErrorMessage } from "../errors"
import { useAddMealItems, useAnalyzeMealPhoto } from "../hooks"
import {
  PHOTO_ACCEPT,
  PHOTO_UNREADABLE_MESSAGE,
  PhotoReadError,
  UPLOAD_TOO_LARGE_MESSAGE,
  UploadTooLargeError,
  browserPhotoProcessor,
  checkPhotoReadable,
  photoFileError,
  preparePhotoUpload,
  type PhotoProcessor,
} from "../photo"
import { proposalFromAnalysis } from "../proposal"
import type { MealType, SavableItemPayload } from "../types"
import { ConfirmDialog } from "./ConfirmDialog"
import { PhotoPicker } from "./PhotoPicker"
import { PhotoReview } from "./PhotoReview"

export function MealPhotoDialog({
  mealType,
  label,
  date,
  onClose,
  onRegisterManually,
  photoProcessor = browserPhotoProcessor,
}: {
  mealType: MealType
  label: string
  date: string
  onClose: () => void
  onRegisterManually: () => void // cierra este diálogo y abre «Añadir a {sección}»
  photoProcessor?: PhotoProcessor // por defecto browserPhotoProcessor
}): ReactElement {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [upload, setUpload] = useState<Blob | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null)
  const analyze = useAnalyzeMealPhoto()
  const add = useAddMealItems(date)
  const previewRef = useRef<string | null>(null)
  const changeInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const pickCounterRef = useRef(0)

  // La vista previa se libera al desmontar el diálogo.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (previewRef.current) photoProcessor.revokePreviewUrl(previewRef.current)
      previewRef.current = null
    }
  }, [photoProcessor])

  const analysis = analyze.isSuccess ? analyze.data : null
  const hasFoods = analysis !== null && (analysis.items.length > 0 || analysis.unmatched.length > 0)
  const initialEntries = useMemo(
    () => (analysis && hasFoods ? proposalFromAnalysis(analysis) : []),
    [analysis, hasFoods]
  )

  function discardPhoto() {
    if (previewRef.current) photoProcessor.revokePreviewUrl(previewRef.current)
    previewRef.current = null
    setPreviewUrl(null)
    setFile(null)
    setUpload(null)
    setUploadError(null)
    analyze.reset()
  }

  async function handlePick(picked: File) {
    discardPhoto()
    const pickId = ++pickCounterRef.current
    const invalid = photoFileError(picked)
    if (invalid) {
      setPhotoError(invalid)
      return
    }
    try {
      await checkPhotoReadable(picked, photoProcessor)
    } catch {
      if (!mountedRef.current || pickId !== pickCounterRef.current) return
      setPhotoError(PHOTO_UNREADABLE_MESSAGE)
      return
    }
    // Si el diálogo se cerró o se eligió otra foto durante la comprobación, esta ya no cuenta
    // y no se crea una URL que nadie liberaría.
    if (!mountedRef.current || pickId !== pickCounterRef.current) return
    setPhotoError(null)
    const url = photoProcessor.createPreviewUrl(picked)
    previewRef.current = url
    setPreviewUrl(url)
    setFile(picked)
  }

  async function handleAnalyze() {
    if (!file || preparing || analyze.isPending) return
    setUploadError(null)
    analyze.reset()
    setPreparing(true)
    let image: Blob
    try {
      image = await preparePhotoUpload(file, photoProcessor)
    } catch (error) {
      if (!mountedRef.current) return
      setPreparing(false)
      if (error instanceof UploadTooLargeError) setUploadError(UPLOAD_TOO_LARGE_MESSAGE)
      else if (error instanceof PhotoReadError) setUploadError(PHOTO_UNREADABLE_MESSAGE)
      else setUploadError(PHOTO_UNREADABLE_MESSAGE)
      return
    }
    // Si el diálogo se cerró mientras se preparaba la imagen, no se envía.
    if (!mountedRef.current) return
    setPreparing(false)
    setUpload(image)
    analyze.mutate(image)
  }

  function handleRetry() {
    if (upload && !analyze.isPending) analyze.mutate(upload)
  }

  function handleChangeInput(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ""
    if (picked) void handlePick(picked)
  }

  async function save(items: SavableItemPayload[]) {
    if (add.isPending) return
    try {
      await add.mutateAsync({ date, meal_type: mealType, items })
    } catch {
      return
    }
    onClose()
  }

  const busy = preparing || analyze.isPending
  const errorView = analyze.isError ? analysisErrorView(analyze.error) : null
  const noFoods = analysis !== null && !hasFoods
  const reviewing = analysis !== null && hasFoods

  // Con una propuesta a medias, cerrar pide confirmación; mientras se guarda, no cierra.
  function requestClose() {
    if (add.isPending) return
    if (reviewing) setConfirmingDiscard(true)
    else onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose()
      }}
    >
      <DialogContent
        ref={setContentElement}
        showCloseButton={false}
        // Sin transform (translate-none!): un ancestro con translate/scale haría que la
        // confirmación anidada (position: fixed) se midiera contra este diálogo y no
        // contra la ventana. Se centra con left/right 0 y margen automático.
        className="top-[5vh] right-0 left-0 mx-auto max-h-[90vh] translate-none! overflow-y-auto max-sm:top-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
      >
        <DialogHeader>
          <DialogTitle>{`Añadir a ${label} con una foto`}</DialogTitle>
          <DialogDescription>Puedes analizar hasta 10 fotos por hora.</DialogDescription>
        </DialogHeader>

        {reviewing && (
          <PhotoReview
            initialEntries={initialEntries}
            label={label}
            isSaving={add.isPending}
            saveError={add.isError ? saveErrorMessage(add.error) : null}
            onSave={(items) => void save(items)}
            onCancel={requestClose}
          />
        )}

        {!reviewing && (
          <div className="space-y-4">
            {file === null && (
              <>
                {photoError && (
                  <p role="alert" className="text-sm text-destructive">
                    {photoError}
                  </p>
                )}
                <PhotoPicker onPick={(picked) => void handlePick(picked)} />
              </>
            )}

            {file !== null && previewUrl !== null && (
              <>
                <img
                  src={previewUrl}
                  alt="Vista previa de la foto"
                  className="max-h-64 w-full rounded-lg object-contain"
                />
                <input
                  ref={changeInputRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  data-testid="meal-photo-file-input"
                  onChange={handleChangeInput}
                />

                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                  {busy ? "Analizando la foto…" : noFoods ? NO_FOODS_MESSAGE : ""}
                </p>
                {uploadError && (
                  <p role="alert" className="text-sm text-destructive">
                    {uploadError}
                  </p>
                )}
                {errorView && (
                  <p role="alert" className="text-sm text-destructive">
                    {errorView.message}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {errorView?.canRetry ? (
                    <Button type="button" onClick={handleRetry} disabled={busy}>
                      Reintentar
                    </Button>
                  ) : (
                    !noFoods &&
                    !errorView &&
                    !uploadError && (
                      <Button type="button" onClick={() => void handleAnalyze()} disabled={busy}>
                        Analizar foto
                      </Button>
                    )
                  )}
                  {(!errorView || errorView.canChangePhoto) && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => changeInputRef.current?.click()}
                    >
                      Cambiar foto
                    </Button>
                  )}
                  {(errorView?.canRegisterManually || noFoods) && (
                    <Button type="button" variant="outline" onClick={onRegisterManually}>
                      Registrar a mano
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={onClose}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}

            {file === null && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
        {confirmingDiscard && (
          <ConfirmDialog
            title="¿Descartar la propuesta?"
            description="Perderás los alimentos propuestos. El análisis ya cuenta para el límite de 10 por hora."
            confirmLabel="Descartar"
            cancelLabel="Seguir revisando"
            container={contentElement}
            onConfirm={onClose}
            onCancel={() => setConfirmingDiscard(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
