declare module '$app/navigation' {
  export function afterNavigate(callback: (navigation: { to: { url: URL } | null }) => void): void
}
