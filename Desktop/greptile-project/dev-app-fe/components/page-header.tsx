import { ChevronRight } from "lucide-react"

export function PageHeader() {
  return (
    <header className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <span>Home</span>
          <ChevronRight className="w-4 h-4" />
          <span>Developer tools</span>
        </nav>

        {/* Main heading */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">Changelog</h1>
          <p className="text-xl text-gray-600 font-normal">Keep track of changes and upgrades to the API.</p>
        </div>
      </div>
    </header>
  )
}
