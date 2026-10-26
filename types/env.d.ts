declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_STRAPI_API_URL: string
      NEXT_PUBLIC_POLVO_API_URL: string
      /** Server-only. Same value as polvo's SERVICE_API_KEY; needed to get a Polvo token. */
      POLVO_SERVICE_API_KEY?: string
      NODE_ENV: 'development' | 'production' | 'test'
    }
  }
}

export {}
