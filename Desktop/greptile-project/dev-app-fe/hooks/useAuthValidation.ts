"use client"

import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

interface AuthValidationState {
  isValidating: boolean
  isValid: boolean | null
  error: string | null
}

/**
 * Hook to validate GitHub auth token on page refresh/load
 * Redirects to auth page if token is invalid
 */
export function useAuthValidation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [state, setState] = useState<AuthValidationState>({
    isValidating: false,
    isValid: null,
    error: null
  })

  const validateToken = async (token: string): Promise<boolean> => {
    try {

      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      })

      if (response.status === 401 || response.status === 403) {
        return false
      }

      if (!response.ok) {
        return true
      }

      return true
    } catch (error) {
      return true
    }
  }

  const handleInvalidToken = async () => {
    setState(prev => ({ 
      ...prev, 
      isValid: false, 
      error: 'Authentication expired' 
    }))

    try {
      await signOut({ 
        redirect: false,
        callbackUrl: '/auth'
      })
      
      window.location.href = '/auth'
    } catch (error) {
      window.location.href = '/auth'
    }
  }

  useEffect(() => {
    // Only validate when we have a session and access token
    if (status === "loading") return
    if (!session?.accessToken) return

    // Skip validation if we already know the token is valid
    if (state.isValid === true) return

    setState(prev => ({ ...prev, isValidating: true, error: null }))

    validateToken(session.accessToken)
      .then(isValid => {
        setState(prev => ({ 
          ...prev, 
          isValidating: false, 
          isValid,
          error: isValid ? null : 'Token validation failed'
        }))

        if (!isValid) {
          handleInvalidToken()
        }
      })
      .catch(error => {
        setState(prev => ({ 
          ...prev, 
          isValidating: false, 
          error: error.message 
        }))
      })
  }, [session?.accessToken, status])

  return {
    isValidating: state.isValidating,
    isValid: state.isValid,
    error: state.error,
    hasSession: !!session,
    isLoading: status === "loading"
  }
} 