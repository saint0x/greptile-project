"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, GitBranch, Search, Bot, CheckCircle } from "lucide-react"
import type { Repository } from "@/types/changelog"

interface LoadingStateProps {
  repository?: Repository
  branch: string
  generationStatus?: {
    status: string
    progress: number
  }
}

const loadingSteps = [
  {
    icon: Search,
    title: "Fetching commits",
    description: "Analyzing repository history and recent changes...",
    progressThreshold: 10
  },
  {
    icon: GitBranch,
    title: "Processing changes",
    description: "Categorizing commits and identifying key updates...",
    progressThreshold: 40
  },
  {
    icon: Bot,
    title: "AI analysis",
    description: "Generating human-readable changelog content...",
    progressThreshold: 80
  },
  {
    icon: CheckCircle,
    title: "Finalizing",
    description: "Structuring and formatting your changelog...",
    progressThreshold: 100
  }
]

export function LoadingState({ repository, branch, generationStatus }: LoadingStateProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Update current step based on actual progress
  useEffect(() => {
    if (generationStatus?.progress !== undefined) {
      const progress = generationStatus.progress
      
      // Find the appropriate step based on progress
      let stepIndex = 0
      for (let i = 0; i < loadingSteps.length; i++) {
        if (progress >= loadingSteps[i].progressThreshold) {
          stepIndex = i
        } else {
          break
        }
      }
      setCurrentStep(stepIndex)
    }
  }, [generationStatus?.progress])

  // Track elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const CurrentIcon = loadingSteps[currentStep].icon
  const progress = generationStatus?.progress || 0
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center max-w-md mx-auto px-6"
      >
        {/* Main Icon with Animation */}
        <div className="relative mb-8">
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <CurrentIcon className="w-20 h-20 text-blue-600" />
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Progress Ring - Based on actual progress */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="rgb(219 234 254)"
                strokeWidth="8"
                fill="none"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                stroke="rgb(59 130 246)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                animate={{ 
                  strokeDashoffset: 2 * Math.PI * 40 * (1 - progress / 100)
                }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Current Step Info */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {loadingSteps[currentStep].title}
            </h2>
            <p className="text-gray-600 mb-6">
              {loadingSteps[currentStep].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Repository Info */}
        {repository && (
          <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 mb-6">
            <div className="text-sm text-gray-700">
              <p className="font-medium">{repository.owner}/{repository.name}</p>
              <p className="text-gray-500 flex items-center gap-1 mt-1">
                <GitBranch className="w-3 h-3" />
                {branch}
              </p>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex justify-center space-x-3 mb-4">
          {loadingSteps.map((step, index) => {
            const StepIcon = step.icon
            const isCompleted = progress >= step.progressThreshold
            const isCurrent = index === currentStep
            
            return (
              <motion.div
                key={index}
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCompleted 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : isCurrent 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: isCurrent ? 1.1 : 1,
                  transition: { duration: 0.3 }
                }}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <StepIcon className="w-4 h-4" />
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Elapsed time */}
        <p className="text-xs text-gray-400">
          Elapsed: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
        </p>
      </motion.div>
    </div>
  )
}
