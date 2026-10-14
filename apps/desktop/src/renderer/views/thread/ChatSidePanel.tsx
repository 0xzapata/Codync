import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { usePresence } from '../../components/Overlay'

/** Animate the available conversation width on both opening and closing. */
export function ChatSidePanel({ open, width, resize, children }: {
  open: boolean
  width: number
  resize?: { min: number; max: number; onChange: (width: number) => void }
  children: ReactNode
}) {
  // Animate explicit open/close actions without animating the initial mount.
  const { mounted, shown } = usePresence(open, 300, false)
  const drag = useRef<{ x: number; width: number; pointer: number; latest: number } | null>(null)
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const resizing = open && !!resize && dragWidth !== null
  const clamp = (next: number) => resize ? Math.min(resize.max, Math.max(resize.min, next)) : width
  const visibleWidth = resizing ? clamp(dragWidth) : width
  const last = useRef({ width, children })
  if (open) last.current = { width: visibleWidth, children }
  const content = open ? { width: visibleWidth, children } : last.current
  const changeWidth = (next: number) => {
    if (resize) resize.onChange(clamp(next))
  }
  const resizable = !!resize
  useEffect(() => {
    if (!open || !resizable) {
      drag.current = null
      setDragWidth(null)
    }
  }, [open, resizable])
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!resize || !open || e.button !== 0 || drag.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width, pointer: e.pointerId, latest: width }
    setDragWidth(width)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!open || !resize || start?.pointer !== e.pointerId) return
    start.latest = clamp(start.width + start.x - e.clientX)
    setDragWidth(start.latest)
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>, save = false) => {
    const start = drag.current
    if (start?.pointer !== e.pointerId) return
    drag.current = null
    setDragWidth(null)
    // Persist once; cancellation or lost capture leaves the saved preference untouched.
    if (save && open && clamp(start.latest) !== width) changeWidth(start.latest)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!resize || !open || drag.current) return
    const next = { ArrowLeft: width + 20, ArrowRight: width - 20, Home: resize.min, End: resize.max }[e.key]
    if (next === undefined) return
    e.preventDefault()
    changeWidth(next)
  }
  return (
    <div className={`side-panel ${shown ? 'shown' : ''} ${resizing ? 'resizing' : ''}`} inert={!open}
      style={{ width: shown ? content.width + 1 : 0 }}>
      {mounted ? <>
        <div
          className={`side-panel-border ${resize ? 'side-panel-divider' : ''}`}
          role={resize ? 'separator' : undefined}
          aria-label={resize ? 'Resize thread panel' : undefined}
          aria-orientation={resize ? 'vertical' : undefined}
          aria-valuemin={resize?.min}
          aria-valuemax={resize?.max}
          aria-valuenow={resize ? visibleWidth : undefined}
          tabIndex={resize ? 0 : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e)}
          onLostPointerCapture={(e) => endDrag(e)}
          onKeyDown={onKeyDown}
        />
        <div style={{ width: content.width, height: '100%', flex: 'none' }}>{content.children}</div>
      </> : null}
    </div>
  )
}
