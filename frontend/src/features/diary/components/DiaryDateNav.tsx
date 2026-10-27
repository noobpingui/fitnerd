import type { ReactElement } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { shiftIsoDate } from "@/lib/dates"
import { diaryDateBounds, isIsoDate } from "../days"

export function DiaryDateNav({
  date,
  today,
  onChange,
}: {
  date: string
  today: string
  onChange: (date: string) => void
}): ReactElement {
  const { min, max } = diaryDateBounds(today)

  function handlePick(value: string) {
    if (isIsoDate(value) && value >= min && value <= max) onChange(value)
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Día anterior"
        disabled={date <= min}
        onClick={() => onChange(shiftIsoDate(date, -1))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Label htmlFor="diary-date" className="sr-only">
        Elegir día
      </Label>
      <Input
        id="diary-date"
        type="date"
        className="w-auto"
        value={date}
        min={min}
        max={max}
        onChange={(event) => handlePick(event.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Día siguiente"
        disabled={date >= today}
        onClick={() => onChange(shiftIsoDate(date, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
      {date !== today && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(today)}>
          Hoy
        </Button>
      )}
    </div>
  )
}
