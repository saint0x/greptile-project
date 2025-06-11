interface ReleaseDateFormatterProps {
  dateString: string
}

export function ReleaseDateFormatter({ dateString }: ReleaseDateFormatterProps) {
  const date = new Date(dateString)
  const month = date.toLocaleDateString("en-US", { month: "long" })
  const year = date.getFullYear()

  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-2xl font-bold text-gray-900">{month}</h3>
      <span className="text-sm text-gray-500 font-medium">{year}</span>
    </div>
  )
}
