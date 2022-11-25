declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production'

    PLASMO_PUBLIC_SHIP_NAME?: string
    PLASMO_PUBLIC_SHIELD_FREQUENCY?: string

    PLASMO_PUBLIC_SITE_URL?: string
  }
}

declare module '*.svg' {
  const content: any
  export default content
}
