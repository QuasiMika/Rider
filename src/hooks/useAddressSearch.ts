import { useState, useEffect, useRef } from 'react'
import { searchAddresses } from '../utils/geocoding'
import type { AddressSuggestion } from '../utils/geocoding'

const DEBOUNCE_MS = 350

export function useAddressSearch(query: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const results = await searchAddresses(query, controller.signal)
      if (!controller.signal.aborted) {
        setSuggestions(results)
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
      setLoading(false)
    }
  }, [query])

  return { suggestions, loading }
}
