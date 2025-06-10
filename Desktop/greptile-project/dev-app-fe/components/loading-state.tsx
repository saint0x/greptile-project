"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import type { Repository } from "@/types/changelog"

interface LoadingStateProps {
  repository?: Repository
  branch: string
}

export function LoadingState({ repository, branch }: LoadingStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="relative mb-8">
          <Sparkles className="w-20 h-20 mx-auto text-blue-600 opacity-75" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-500 rounded-full" />
          </motion.div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Analyzing Repository</h2>
        <p className="text-gray-600 max-w-sm mx-auto">
          AI is analyzing git commits and generating your professional changelog...
        </p>
        {repository && (
          <div className="mt-4 text-sm text-gray-500">
            <p>
              {repository.owner}/{repository.name} • {branch}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
