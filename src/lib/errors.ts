export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

export function handleAPIError(error: unknown) {
  if (error instanceof APIError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    },
    timestamp: new Date().toISOString()
  };
}