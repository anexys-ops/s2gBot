import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tagsApi } from '../api/client'

interface Tag {
  id: number
  name: string
  color?: string
}

interface TagsInputProps {
  selectedTags?: Tag[]
  onTagsChange?: (tags: Tag[]) => void
  placeholder?: string
}

export default function TagsInput({ selectedTags = [], onTagsChange, placeholder = 'Ajouter un tag…' }: TagsInputProps) {
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: availableTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  })

  const createMut = useMutation({
    mutationFn: (body: { name: string; color?: string }) => tagsApi.create(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tags'] }),
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTagSelect = (tag: Tag) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id)
    const newTags = isSelected ? selectedTags.filter((t) => t.id !== tag.id) : [...selectedTags, tag]
    onTagsChange?.(newTags)
    setInput('')
  }

  const handleRemoveTag = (tagId: number) => {
    const newTags = selectedTags.filter((t) => t.id !== tagId)
    onTagsChange?.(newTags)
  }

  const handleCreateTag = async () => {
    if (input.trim()) {
      createMut.mutate({ name: input.trim() })
      setInput('')
    }
  }

  const filteredTags = availableTags.filter(
    (tag) => tag.name.toLowerCase().includes(input.toLowerCase()) && !selectedTags.some((t) => t.id === tag.id)
  )

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: tag.color || '#e9ecef',
              color: '#333',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: '1rem',
                lineHeight: 1,
              }}
              aria-label={`Supprimer ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (input.trim() && !availableTags.some((t) => t.name.toLowerCase() === input.toLowerCase())) {
                handleCreateTag()
              } else if (filteredTags.length > 0) {
                handleTagSelect(filteredTags[0])
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false)
            }
          }}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '0.95rem',
          }}
        />
      </div>

      {isOpen && (filteredTags.length > 0 || input.trim()) && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
            listStyle: 'none',
            padding: 0,
            margin: 0,
            zIndex: 1000,
          }}
          role="listbox"
        >
          {filteredTags.map((tag) => (
            <li
              key={tag.id}
              onClick={() => handleTagSelect(tag)}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                backgroundColor: 'white',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'white')}
              role="option"
            >
              {tag.name}
            </li>
          ))}
          {input.trim() && !availableTags.some((t) => t.name.toLowerCase() === input.toLowerCase()) && (
            <li
              onClick={handleCreateTag}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                backgroundColor: '#f9f9f9',
                fontStyle: 'italic',
                color: '#666',
                borderTop: '1px solid #eee',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#e9ecef')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f9f9f9')}
            >
              + Créer "{input.trim()}"
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
