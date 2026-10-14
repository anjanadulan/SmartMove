"use client"
import * as React from "react"
import { useState, useRef, useEffect, useId } from "react"
import { IconChevronDown, IconCheck } from "@tabler/icons-react"

export type SelectOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export function SmartSelect({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  className = "",
  size = "default",
  ariaLabel,
}: {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (val: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  size?: "default" | "sm"
  ariaLabel?: string
}) {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue !== undefined
      ? defaultValue
      : options.length > 0 && required
        ? options[0].value
        : ""
  )
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const currentValue = isControlled ? controlledValue : internalValue

  const selectedOption = options.find((opt) => opt.value === currentValue)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(val: string) {
    if (!isControlled) {
      setInternalValue(val)
    }
    onChange?.(val)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setIsOpen(true)
        const currentIdx = options.findIndex((o) => o.value === currentValue)
        setHighlightIndex(currentIdx >= 0 ? currentIdx : 0)
        return
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) =>
        prev < options.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : options.length - 1
      )
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (highlightIndex >= 0 && options[highlightIndex]) {
        if (!options[highlightIndex].disabled) {
          handleSelect(options[highlightIndex].value)
        }
      } else {
        setIsOpen(false)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setIsOpen(false)
      setHighlightIndex(-1)
    } else if (e.key === "Tab") {
      setIsOpen(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`smart-select ${size === "sm" ? "select-sm" : ""} ${className}`}
    >
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          required={required}
        />
      )}
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev)
            const currentIdx = options.findIndex((o) => o.value === currentValue)
            setHighlightIndex(currentIdx >= 0 ? currentIdx : 0)
          }
        }}
        onKeyDown={handleKeyDown}
        className={`smart-select-trigger ${isOpen ? "open" : ""}`}
      >
        <span
          className={`smart-select-trigger-label ${
            !selectedOption ? "placeholder" : ""
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <IconChevronDown
          size={16}
          className={`smart-select-chevron ${isOpen ? "open" : ""}`}
        />
      </button>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel || placeholder}
          className="smart-select-popup"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === currentValue
            const isHighlighted = highlightIndex === idx
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                className={`smart-select-item ${
                  isSelected ? "selected" : ""
                } ${isHighlighted ? "highlighted" : ""} ${
                  opt.disabled ? "disabled" : ""
                }`}
                onMouseEnter={() => {
                  if (!opt.disabled) setHighlightIndex(idx)
                }}
                onClick={() => {
                  if (!opt.disabled) handleSelect(opt.value)
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <IconCheck size={14} className="smart-select-check" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
