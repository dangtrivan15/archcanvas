"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  const prefersReduced = useReducedMotion()

  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      asChild
      {...props}
    >
      <motion.div
        initial={
          prefersReduced
            ? false
            : {
                scaleX: orientation === "horizontal" ? 0 : 1,
                scaleY: orientation === "vertical" ? 0 : 1,
              }
        }
        animate={{ scaleX: 1, scaleY: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "shrink-0 bg-border",
          orientation === "horizontal"
            ? "h-px w-full origin-left"
            : "h-full w-px origin-top",
          className
        )}
      />
    </SeparatorPrimitive.Root>
  )
}

export { Separator }
