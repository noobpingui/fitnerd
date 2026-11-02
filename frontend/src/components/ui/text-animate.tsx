// Versión reducida de "Text Animate" de Magic UI (magicui.design) con el
// preset blurInUp: cada palabra entra desde abajo con un desenfoque que se aclara.
import { motion, useReducedMotion, type Variants } from "motion/react"
import { cn } from "@/lib/utils"

const STAGGER = 0.15

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { delayChildren: 0, staggerChildren: STAGGER } },
}

const blurInUp: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 20 },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: {
      y: { duration: 0.7 },
      opacity: { duration: 0.8 },
      filter: { duration: 0.7 },
    },
  },
}

const elements = { h1: motion.h1, h2: motion.h2, p: motion.p }

interface TextAnimateProps {
  children: string
  className?: string
  segmentClassName?: string
  /** Índice de la primera palabra que recibe `highlightClassName`. */
  highlightFrom?: number
  highlightClassName?: string
  as?: keyof typeof elements
}

export function TextAnimate({
  children,
  className,
  segmentClassName,
  highlightFrom,
  highlightClassName,
  as = "p",
}: TextAnimateProps) {
  const reduceMotion = useReducedMotion()
  const MotionComponent = elements[as]
  const words = children.split(" ")

  return (
    <MotionComponent
      className={className}
      variants={container}
      initial={reduceMotion ? "show" : "hidden"}
      animate="show"
      aria-label={children}
    >
      {words.map((word, index) => {
        const isHighlighted = highlightFrom !== undefined && index >= highlightFrom
        return (
          <motion.span
            key={`${word}-${index}`}
            aria-hidden="true"
            variants={reduceMotion ? undefined : blurInUp}
            // El destello llega a cada palabra resaltada con un pequeño
            // retraso, para que parezca una sola pasada de izquierda a derecha.
            style={isHighlighted ? { animationDelay: `${(index - highlightFrom) * 0.35}s` } : undefined}
            className={cn(
              "inline-block whitespace-pre",
              segmentClassName,
              isHighlighted && highlightClassName
            )}
          >
            {index < words.length - 1 ? `${word} ` : word}
          </motion.span>
        )
      })}
    </MotionComponent>
  )
}
