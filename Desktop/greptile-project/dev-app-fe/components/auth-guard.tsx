"use client"

import type React from "react"
import { useAuthValidation } from "@/hooks/useAuthValidation"

interface AuthGuardProps {
  children: React.ReactNode
  loadingComponent?: React.ReactNode
}

/**
 * AuthGuard component that validates GitHub token and redirects if invalid
 * Use this to wrap protected pages/components
 */
export function AuthGuard({ children, loadingComponent }: AuthGuardProps) {
  const { isValidating, isValid, isLoading, hasSession, error } = useAuthValidation()

  // Show loading while NextAuth is initializing
  if (isLoading) {
    return (
      loadingComponent || (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Initializing...</p>
          </div>
        </div>
      )
    )
  }

  // Show loading while validating GitHub token
  if (isValidating) {
    return (
      loadingComponent || (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Validating authentication...</p>
          </div>
        </div>
      )
    )
  }

  // If token validation failed, redirect immediately
  if (isValid === false) {
    // The hook handles the redirect, but ensure we don't render content
    if (typeof window !== 'undefined') {
      // Redirect immediately if not already redirecting
      setTimeout(() => {
        window.location.href = '/auth'
      }, 100)
    }
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Authentication expired. Redirecting...</p>
          {error && <p className="text-sm text-gray-500 mt-2">{error}</p>}
        </div>
      </div>
    )
  }

  // If no session, redirect to auth
  if (!hasSession && !isLoading) {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.href = '/auth'
      }, 100)
    }
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to authentication...</p>
        </div>
      </div>
    )
  }

  // Token is valid or still checking - render children
  return <>{children}</>
} 