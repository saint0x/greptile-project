import { Badge } from "@/components/ui/badge"
import { tagColors } from "@/types/changelog"

interface TagBadgeProps {
  tag: string
  size?: "sm" | "md"
}

export function TagBadge({ tag, size = "md" }: TagBadgeProps) {
  const colorClass = tagColors[tag] || "bg-gray-100 text-gray-800"
  const sizeClass = size === "sm" ? "text-xs" : "text-sm"

  return (
    <Badge variant="secondary" className={`${colorClass} ${sizeClass} font-medium`}>
      {tag}
    </Badge>
  )
}
