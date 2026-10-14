import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
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
  const last = useRef({ width, children })
  if (open) last.current = { width, children }
  const content = open ? { width, children } : last.current
  const drag = useRef<{ x: number; width: number; pointer: number } | null>(null)
  const [resizing, setResizing] = useState(false)
  const changeWidth = (next: number) => {
    if (resize) resize.onChange(Math.min(resize.max, Math.max(resize.min, next)))
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!resize || !open || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width, pointer: e.pointerId }
    setResizing(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (open && start?.pointer === e.pointerId) changeWidth(start.width + start.x - e.clientX)
  }
  const endDrag = () => {
    drag.current = null
    setResizing(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!resize || !open) return
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
          aria-valuenow={resize ? width : undefined}
          tabIndex={resize ? 0 : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={onKeyDown}
        />
        <div style={{ width: content.width, height: '100%', flex: 'none' }}>{content.children}</div>
      </> : null}
    </div>
  )
}
