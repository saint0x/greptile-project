"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"

export default function AuthPage() {
  const handleGitHubSignIn = () => {
    signIn("github", { callbackUrl: "/" })
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Changelog Developer Tools
          </h1>
          <p className="text-lg text-gray-600 max-w-md">
            Connect your GitHub account to start generating changelogs from your repositories
          </p>
        </div>
        
        <div className="flex justify-center">
          <Button
            onClick={handleGitHubSignIn}
            size="lg"
            className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-full inline-flex items-center gap-3 text-lg font-medium transition-colors"
          >
            <Github className="w-6 h-6" />
            Continue with GitHub
          </Button>
        </div>
      </div>
    </div>
  )
} 