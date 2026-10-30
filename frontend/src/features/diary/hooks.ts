import { useCallback, useEffect, useRef, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query"
import { foodLibraryKeys } from "@/features/food-library/hooks"
import { ApiError } from "@/lib/apiClient"
import { todayIsoDate } from "@/lib/dates"
import {
  addMealItems,
  analyzeMealPhoto,
  deleteMeal,
  estimatePortion,
  getDiary,
  removeMealItem,
  restoreMealItem,
  updateMealItemGrams,
} from "./api"
import { TODAY_CHECK_INTERVAL_MS, UNDO_DURATION_MS } from "./constants"
import { portionEstimateErrorAnswer, undoErrorMessage } from "./errors"
import { portionAnswerFromEstimate } from "./portionChat"
import { portionQuestionFormSchema } from "./schemas"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type {
  AddMealItemsPayload,
  Meal,
  MealPhotoAnalysis,
  PortionChatAnswer,
  PortionChatTurn,
  PortionEstimate,
  PortionQuestionFormValues,
  RemovalUndo,
} from "./types"

export const diaryKeys = { day: (date: string) => ["diary", date] as const }

export function useDiary(date: string) {
  return useQuery({ queryKey: diaryKeys.day(date), queryFn: () => getDiary(date) })
}

// onSuccess devuelve la promesa de la invalidación: la mutación no termina
// hasta que el diario se ha vuelto a leer.
export function useAddMealItems(date: string) {
  const queryClient = useQueryClient()
  return useMutation<Meal, Error, AddMealItemsPayload>({
    mutationFn: (payload) => addMealItems(payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
        queryClient.invalidateQueries({ queryKey: foodLibraryKeys.all }),
      ]),
  })
}

// Sin reintentos: cada análisis cuenta para el límite de 10 por hora.
export function useAnalyzeMealPhoto(): UseMutationResult<MealPhotoAnalysis, Error, Blob> {
  return useMutation<MealPhotoAnalysis, Error, Blob>({
    mutationFn: (image) => analyzeMealPhoto(image),
    retry: false,
  })
}

export function useUpdateMealItemGrams(date: string) {
  const queryClient = useQueryClient()
  return useMutation<Meal, Error, { mealId: number; itemId: number; grams: number }>({
    mutationFn: ({ mealId, itemId, grams }) => updateMealItemGrams(mealId, itemId, grams),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}

export function useRemoveMealItem(date: string) {
  const queryClient = useQueryClient()
  return useMutation<string | null, Error, { mealId: number; itemId: number }>({
    mutationFn: ({ mealId, itemId }) => removeMealItem(mealId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}

export function useRestoreMealItem(date: string): UseMutationResult<Meal, Error, string> {
  const queryClient = useQueryClient()
  return useMutation<Meal, Error, string>({
    mutationFn: (restoreToken) => restoreMealItem(restoreToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}

// Un 404 cuenta como éxito: la comida ya no existe, que es lo que se pedía.
export function useDeleteMeal(date: string): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (mealId) => {
      try {
        await deleteMeal(mealId)
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.day(date) }),
  })
}

// Fecha local de hoy, vigilada cada `intervalMs` y al volver la pestaña a estar visible.
// En pausa no cambia; al quitar la pausa se comprueba en el acto.
export function useToday(
  paused: boolean = false,
  intervalMs: number = TODAY_CHECK_INTERVAL_MS
): string {
  const [today, setToday] = useState(todayIsoDate)

  useEffect(() => {
    if (paused) return
    const check = () => setToday(todayIsoDate())
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") check()
    }
    check()
    const timerId = setInterval(check, intervalMs)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      clearInterval(timerId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [paused, intervalMs])

  return today
}

export type RemovalUndoState = {
  notice: RemovalUndo | null
  offer: (notice: RemovalUndo | null) => void
  undo: () => void
  isRestoring: boolean
  error: string | null
}

export function useRemovalUndo(
  date: string,
  durationMs: number = UNDO_DURATION_MS
): RemovalUndoState {
  const restore = useRestoreMealItem(date)
  const [notice, setNotice] = useState<RemovalUndo | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const offer = useCallback(
    (next: RemovalUndo | null) => {
      clearTimer()
      setNotice(next)
      if (next) timerRef.current = setTimeout(() => setNotice(null), durationMs)
    },
    [clearTimer, durationMs]
  )

  const undo = useCallback(() => {
    if (!notice || inFlightRef.current) return
    inFlightRef.current = true
    restore.mutate(notice.token, {
      onSuccess: () => {
        clearTimer()
        setNotice(null)
      },
      onSettled: () => {
        inFlightRef.current = false
      },
    })
  }, [notice, restore, clearTimer])

  return {
    notice,
    offer,
    undo,
    isRestoring: restore.isPending,
    // El error pertenece al aviso cuyo token falló: un aviso nuevo no lo hereda.
    error:
      restore.isError && notice !== null && restore.variables === notice.token
        ? undoErrorMessage(restore.error)
        : null,
  }
}

// Sin reintentos ni invalidaciones: cada pregunta cuenta para el límite y no toca el diario.
export function useEstimatePortion(): UseMutationResult<PortionEstimate, Error, string> {
  return useMutation<PortionEstimate, Error, string>({
    mutationFn: (question) => estimatePortion(question),
    retry: false,
  })
}

export type PortionChatState = {
  form: UseFormReturn<PortionQuestionFormValues>
  turns: PortionChatTurn[]
  isPending: boolean
  submit: (values: PortionQuestionFormValues) => void
}

// El estado vive en DiaryPage (que no se desmonta al cambiar de día) para conservar la conversación.
export function usePortionChat(): PortionChatState {
  const estimate = useEstimatePortion()
  const form = useForm<PortionQuestionFormValues>({
    resolver: zodResolver(portionQuestionFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: { question: "" },
  })
  const [turns, setTurns] = useState<PortionChatTurn[]>([])
  const nextIdRef = useRef(1)
  const inFlightRef = useRef(false)

  const submit = useCallback(
    (values: PortionQuestionFormValues) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      const id = nextIdRef.current++
      setTurns((current) => [...current, { id, question: values.question, answer: null }])
      form.setValue("question", "")
      const setAnswer = (answer: PortionChatAnswer) =>
        setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, answer } : turn)))
      estimate
        .mutateAsync(values.question)
        .then(
          (result) => setAnswer(portionAnswerFromEstimate(result)),
          (error: unknown) => setAnswer(portionEstimateErrorAnswer(error))
        )
        .finally(() => {
          inFlightRef.current = false
        })
    },
    [estimate, form]
  )

  return { form, turns, isPending: turns.some((turn) => turn.answer === null), submit }
}
