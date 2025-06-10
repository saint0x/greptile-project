"use client"

import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GenerateButtonProps {
  isDisabled: boolean
  onClick: () => void
}

export function GenerateButton({ isDisabled, onClick }: GenerateButtonProps) {
  return (
    <div className="flex justify-center">
      <Button
        onClick={onClick}
        disabled={isDisabled}
        size="lg"
        className="px-8 py-4 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none shadow-sm hover:shadow-md"
      >
        <Sparkles className="w-5 h-5 mr-3" />
        Generate Changelog
      </Button>
    </div>
  )
}
