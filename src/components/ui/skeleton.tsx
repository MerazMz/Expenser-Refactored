import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-[#e3ded3] dark:bg-zinc-800/80", className)}
      {...props}
    />
  )
}

export { Skeleton }
