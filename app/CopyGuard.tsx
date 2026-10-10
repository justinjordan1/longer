'use client'
import { useEffect } from 'react'

// Backstop for .no-copy: cancels copy/cut/drag when the selection reaches protected text.
export default function CopyGuard() {
  useEffect(() => {
    const touchesProtected = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) return false
      return Array.from(document.querySelectorAll('.no-copy')).some((el) =>
        selection.containsNode(el, true),
      )
    }
    const onCopy = (event: Event) => {
      if (touchesProtected()) event.preventDefault()
    }
    const onDragStart = (event: DragEvent) => {
      if ((event.target as Element | null)?.closest?.('.no-copy') || touchesProtected()) {
        event.preventDefault()
      }
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCopy)
    document.addEventListener('dragstart', onDragStart)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCopy)
      document.removeEventListener('dragstart', onDragStart)
    }
  }, [])
  return null
}
