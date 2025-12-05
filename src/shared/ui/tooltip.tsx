"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "border rounded-2xl border-border relative bg-border/20 backdrop-blur-md text-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        {/* <svg className="absolute -bottom-1/2 left-1/2 translate-y-[calc(-50%_-_2px)] -translate-x-1/2" width="12.990356" height="8.250000" viewBox="0 0 12.9904 8.25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <desc>
              Created with Pixso.
          </desc>
          <defs/>
          <path id="Polygon 1" d="M6.49 8.25L0 0L12.99 0L6.49 8.25Z" fill="#D036FF" fill-opacity="1.000000" fill-rule="evenodd"/>
        </svg> */}

        <TooltipPrimitive.Arrow  className="bg-border [clip-path:polygon(50%_50%,0%_0%,0%_100%)] fill-border z-10 size-2.5 translate-y-[calc(-50%_+_5px)] rotate-90 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
