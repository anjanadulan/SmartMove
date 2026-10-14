"use client"
import * as React from "react"
import { useState, useRef, useEffect, useId } from "react"
import { IconMapPin } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { filterTowns } from "@/lib/sri-lanka-towns"

const POPULAR_HUBS = [
  "Colombo",
  "Pettah (Colombo)",
  "Makumbura (Kottawa)",
  "Kandy",
  "Galle",
  "Matara",
  "Jaffna",
  "Negombo",
  "Kadawatha",
  "Anuradhapura",
  "Kataragama",
  "Dambulla",
  "Kurunegala",
  "Trincomalee",
  "Batticaloa",
  "Badulla",
  "Nuwara Eliya",
  "Ratnapura",
]

export function TownAutocomplete({
  id,
  value,
  onChange,
  placeholder,
  extraTowns = [],
  maxLength = 50,
  ariaLabel,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  extraTowns?: string[]
  maxLength?: number
  ariaLabel?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const suggestions = value.trim()
    ? filterTowns(value, extraTowns, 12)
    : POPULAR_HUBS

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

  function handleSelect(town: string) {
    onChange(town)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true)
        return
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    } else if (
      e.key === "Enter" &&
      highlightIndex >= 0 &&
      suggestions[highlightIndex]
    ) {
      e.preventDefault()
      handleSelect(suggestions[highlightIndex])
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setHighlightIndex(-1)
    }
  }

  function renderTownName(town: string) {
    const q = value.trim()
    if (!q) return town
    const lowerTown = town.toLowerCase()
    const lowerQ = q.toLowerCase()
    const matchIdx = lowerTown.indexOf(lowerQ)
    if (matchIdx === -1) return town

    const before = town.slice(0, matchIdx)
    const match = town.slice(matchIdx, matchIdx + q.length)
    const after = town.slice(matchIdx + q.length)

    return (
      <span>
        {before}
        <strong className="town-suggestion-match">{match}</strong>
        {after}
      </span>
    )
  }

  return (
    <div className="town-autocomplete" ref={containerRef}>
      <div className="input-icon">
        <IconMapPin size={19} />
        <Input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
            setHighlightIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          role="combobox"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}
          className="town-suggestions"
          role="listbox"
          ref={listRef}
        >
          <li className="town-suggestions-header">
            {value.trim() ? "Matching Towns" : "Popular Sri Lankan Hubs"}
          </li>
          {suggestions.map((town, idx) => {
            const isRoute = extraTowns.includes(town)
            return (
              <li
                key={town}
                role="option"
                aria-selected={highlightIndex === idx}
                className={`town-suggestion-item ${
                  highlightIndex === idx ? "active" : ""
                }`}
                onMouseEnter={() => setHighlightIndex(idx)}
                onClick={() => handleSelect(town)}
              >
                <IconMapPin size={15} />
                <span>{renderTownName(town)}</span>
                {isRoute && (
                  <span className="town-suggestion-badge">Active route</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
