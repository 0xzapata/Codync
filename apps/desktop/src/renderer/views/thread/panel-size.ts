/** Keep the reply panel usable and reserve 320 px for the main conversation plus its divider. */
export function threadPanelSize(preferred: unknown, available: number) {
  // ThreadView only opens the side panel at WIDE (680 px); narrower views use a sheet.
  const min = 280
  const max = Math.max(min, Math.floor(available - 321))
  const fallback = Math.min(420, available * 0.45)
  const requested = typeof preferred === 'number' && Number.isFinite(preferred) ? preferred : fallback
  return { min, max, width: Math.min(max, Math.max(min, requested)) }
}
