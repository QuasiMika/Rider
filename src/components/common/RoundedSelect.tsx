import { useId, useState } from 'react'
import './RoundedSelect.css'

export type RoundedSelectOption = {
  value: string
  label: string
}

type Props = {
  className?: string
  value: string
  options: RoundedSelectOption[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function RoundedSelect({ className = '', value, options, disabled = false, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const listboxId = useId()
  const selected = options.find(option => option.value === value) ?? options[0]

  const choose = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div
      className={`rounded-select ${className}`.trim()}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        className="rounded-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
      >
        <span className="rounded-select__label">{selected?.label ?? ''}</span>
        <span className="rounded-select__chevron" aria-hidden="true" />
      </button>

      {open && !disabled && (
        <div className="rounded-select__menu" role="listbox" id={listboxId} tabIndex={-1}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`rounded-select__option${option.value === value ? ' rounded-select__option--active' : ''}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
