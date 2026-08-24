import { Contrast } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/app/ThemeProvider"

export function ThemeToggle() {
  const { toggleTheme } = useTheme()

  return (
    <motion.div whileTap={{ scale: 0.85 }} className="inline-block">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        aria-label="Cambiar tema"
      >
        <Contrast className="h-[1.2rem] w-[1.2rem] rotate-0 transition-transform duration-300 dark:rotate-180" />
      </Button>
    </motion.div>
  )
}
