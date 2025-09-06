import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("main-btn-bg animate-pulse rounded-full", className)}
      {...props}
    />
  )
}

export { Skeleton }
