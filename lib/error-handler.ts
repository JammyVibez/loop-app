import { toast } from "@/hooks/use-toast"

export interface ApiError {
  message: string
  status: number
  code?: string
  details?: any
}

export class ApiErrorHandler {
  static handle(error: any): ApiError {
    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        message: 'Network connection failed. Please check your internet connection.',
        status: 0,
        code: 'NETWORK_ERROR'
      }
    }

    // HTTP errors
    if (error.status) {
      switch (error.status) {
        case 400:
          return {
            message: error.message || 'Invalid request. Please check your input.',
            status: 400,
            code: 'BAD_REQUEST'
          }
        case 401:
          return {
            message: 'Authentication required. Please log in.',
            status: 401,
            code: 'UNAUTHORIZED'
          }
        case 403:
          return {
            message: 'Access denied. You don\'t have permission for this action.',
            status: 403,
            code: 'FORBIDDEN'
          }
        case 404:
          return {
            message: 'Resource not found.',
            status: 404,
            code: 'NOT_FOUND'
          }
        case 429:
          return {
            message: 'Too many requests. Please wait a moment and try again.',
            status: 429,
            code: 'RATE_LIMITED'
          }
        case 500:
          return {
            message: 'Server error occurred. Please try again later.',
            status: 500,
            code: 'INTERNAL_ERROR'
          }
        default:
          return {
            message: error.message || 'An unexpected error occurred.',
            status: error.status,
            code: 'UNKNOWN_ERROR'
          }
      }
    }

    // Generic errors
    return {
      message: error.message || 'An unexpected error occurred.',
      status: 500,
      code: 'GENERIC_ERROR'
    }
  }

  static showToast(error: ApiError) {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    })
  }

  static async handleApiCall<T>(
    apiCall: () => Promise<Response>,
    options?: {
      showToast?: boolean
      customErrorMessages?: Record<number, string>
    }
  ): Promise<T | null> {
    try {
      const response = await apiCall()
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = {
          message: options?.customErrorMessages?.[response.status] || 
                   errorData.error || 
                   `Request failed with status ${response.status}`,
          status: response.status,
          details: errorData
        }
        
        const handledError = this.handle(error)
        
        if (options?.showToast !== false) {
          this.showToast(handledError)
        }
        
        return null
      }

      return await response.json()
    } catch (error) {
      const handledError = this.handle(error)
      
      if (options?.showToast !== false) {
        this.showToast(handledError)
      }
      
      return null
    }
  }
}

// Utility function for making authenticated API calls
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const authToken = token || localStorage.getItem('auth_token')
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

// Retry mechanism for failed requests
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall()
    } catch (error) {
      lastError = error
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
      }
    }
  }

  throw lastError
}
