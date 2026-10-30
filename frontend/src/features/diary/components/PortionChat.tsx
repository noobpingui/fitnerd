import { useEffect, useId, useRef, type ReactElement } from "react"
import { useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PORTION_QUESTION_MAX_LENGTH } from "../constants"
import type { PortionChatState } from "../hooks"
import { formatEstimatedGrams } from "../portionChat"
import type { PortionChatAnswer } from "../types"

function AnswerView({ answer }: { answer: PortionChatAnswer | null }): ReactElement {
  if (answer === null) return <p>Calculando…</p>
  switch (answer.kind) {
    case "estimate":
      return (
        <>
          <p>{formatEstimatedGrams(answer.grams)}</p>
          {answer.unit && <p>Porción: {answer.unit}</p>}
          {answer.note && <p>{answer.note}</p>}
        </>
      )
    case "message":
      return <p>{answer.text}</p>
    case "notice":
      return <p className="text-muted-foreground">{answer.text}</p>
    case "error":
      return <p className="text-destructive">{answer.text}</p>
  }
}

export function PortionChat({ chat }: { chat: PortionChatState }): ReactElement {
  const titleId = useId()
  const logRef = useRef<HTMLDivElement>(null)
  const value = useWatch({ control: chat.form.control, name: "question" }) ?? ""

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [chat.turns])

  return (
    <Card className="mb-4">
      <CardContent>
        <section aria-labelledby={titleId} className="space-y-3">
          <h2 id={titleId} className="text-base font-semibold">
            Calcular gramos con IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Pregunta a la IA cuántos gramos pesa un alimento o una porción, por ejemplo «5 huevos» o
            «un filete de pescado». La respuesta es una estimación aproximada.
          </p>
          <div
            ref={logRef}
            role="log"
            aria-label="Conversación sobre gramos"
            aria-live="polite"
            className="max-h-64 space-y-3 overflow-y-auto text-sm"
          >
            {chat.turns.length === 0 ? (
              <p className="text-muted-foreground">Todavía no has preguntado nada.</p>
            ) : (
              chat.turns.map((turn) => (
                <div key={turn.id} className="space-y-1">
                  <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-muted px-3 py-1.5 text-right">
                    {turn.question}
                  </p>
                  <div>
                    <AnswerView answer={turn.answer} />
                  </div>
                </div>
              ))
            )}
          </div>
          <Form {...chat.form}>
            <form onSubmit={chat.form.handleSubmit(chat.submit)} noValidate className="space-y-2">
              <FormField
                control={chat.form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Alimento o porción</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Por ejemplo: 5 huevos"
                        maxLength={PORTION_QUESTION_MAX_LENGTH}
                        autoComplete="off"
                        {...field}
                        onChange={(event) =>
                          field.onChange(event.target.value.slice(0, PORTION_QUESTION_MAX_LENGTH))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {value.length}/{PORTION_QUESTION_MAX_LENGTH}
                </span>
                <Button type="submit" disabled={value.trim() === "" || chat.isPending}>
                  Preguntar
                </Button>
              </div>
            </form>
          </Form>
        </section>
      </CardContent>
    </Card>
  )
}
