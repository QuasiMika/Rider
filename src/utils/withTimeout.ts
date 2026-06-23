export const API_TIMEOUT_MS = 10_000

export const API_TIMEOUT_MESSAGE =
  'Der Server ist aktuell überlastet oder antwortet nicht. Deine Anfrage konnte nicht verarbeitet werden.'

export function withTimeout<T>(promise: Promise<T>, ms = API_TIMEOUT_MS): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(API_TIMEOUT_MESSAGE)), ms),
  )
  return Promise.race([promise, timeout])
}
