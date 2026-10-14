import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-[#aebcb6] bg-white transition-all outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklch,var(--primary),white_50%)] disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <IconCheck size={14} stroke={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
