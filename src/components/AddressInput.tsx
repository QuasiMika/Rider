import { useState, useRef, useEffect } from 'react'
import { useAddressSearch } from '../hooks/useAddressSearch'
import type { LatLng } from '../utils/geocoding'

type Props = {
  placeholder: string
  value: string
  confirmed: boolean
  onChange: (value: string) => void
  onConfirm: (displayName: string, coords: LatLng) => void
  onClear: () => void
  rightSlot?: React.ReactNode
}

export function AddressInput({ placeholder, value, confirmed, onChange, onConfirm, onClear, rightSlot }: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { suggestions, loading } = useAddressSearch(confirmed ? '' : value)

  useEffect(() => {
    if (suggestions.length > 0 && !confirmed) setOpen(true)
    else setOpen(false)
    setActiveIndex(-1)
  }, [suggestions, confirmed])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    if (confirmed) onClear()
  }

  const handleSelect = (index: number) => {
    const s = suggestions[index]
    if (!s) return
    onConfirm(s.displayName, s.coords)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(activeIndex)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const shortName = (displayName: string) => {
    const parts = displayName.split(',')
    return parts.slice(0, 2).join(',').trim()
  }

  return (
    <div className="addr-wrap" ref={wrapRef}>
      <div className="addr-input-row">
        <input
          ref={inputRef}
          className={`guest-route-card__input${confirmed ? ' addr-input--confirmed' : ''}`}
          type="text"
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0 && !confirmed) setOpen(true) }}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && !confirmed && <span className="addr-spinner" />}
        {rightSlot}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="addr-dropdown" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === activeIndex}
              className={`addr-dropdown__item${i === activeIndex ? ' addr-dropdown__item--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); handleSelect(i) }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="addr-dropdown__main">{shortName(s.displayName)}</span>
              <span className="addr-dropdown__sub">{s.displayName.split(',').slice(2, 4).join(',').trim()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
