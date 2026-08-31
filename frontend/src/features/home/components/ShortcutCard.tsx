import { Link } from "react-router"
import { motion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

type ShortcutCardProps = {
  to: string
  label: string
  description: string
  icon: LucideIcon
  index: number
  onHoverChange: (isHovered: boolean) => void
}

// La card en si ya no sabe nada de imagenes/slideshow - eso ahora vive en
// HomeSlideshowBox, compartido por las 4 cards. Esta card solo le avisa al
// padre (HomePage) cuando el mouse entra/sale, via onHoverChange.
export function ShortcutCard({
  to,
  label,
  description,
  icon: Icon,
  index,
  onHoverChange,
}: ShortcutCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
    >
      <Link to={to}>
        <Card
          className="h-full transition-colors hover:border-primary"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
        >
          <CardContent className="flex flex-col items-start gap-2">
            <Icon className="h-6 w-6 text-primary" />
            <span className="font-medium">{label}</span>
            <span className="text-sm text-muted-foreground">
              {description}
            </span>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
