/// <reference types="vite/client" />

declare module '*.m4a?url' {
  const src: string
  export default src
}

declare module '*.mp3?url' {
  const src: string
  export default src
}
