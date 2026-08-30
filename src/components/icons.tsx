import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function AddIcon(props: IconProps) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" {...props}><path d="M8 2v12M2 8h12" /></svg>
}

export function ShuffleIcon(props: IconProps) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" {...props}><path d="M2 4h2.2c1.3 0 1.9.5 2.5 1.5l2.6 4c.6 1 1.2 1.5 2.5 1.5H14M12 2l2 2-2 2M2 12h2.2c1.3 0 1.9-.5 2.5-1.5l.7-1M10.7 5.5c.6-1 1.2-1.5 2.5-1.5H14M12 10l2 2-2 2" /></svg>
}

export function EyeIcon(props: IconProps) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" {...props}><path d="M1.5 8s2.1-3.5 6.5-3.5S14.5 8 14.5 8 12.4 11.5 8 11.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="1.8" /></svg>
}

export function CloseIcon(props: IconProps) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" {...props}><path d="m3 3 10 10M13 3 3 13" /></svg>
}

export function DragIcon(props: IconProps) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" {...props}><circle cx="5" cy="4" r=".8" fill="currentColor" /><circle cx="11" cy="4" r=".8" fill="currentColor" /><circle cx="5" cy="8" r=".8" fill="currentColor" /><circle cx="11" cy="8" r=".8" fill="currentColor" /><circle cx="5" cy="12" r=".8" fill="currentColor" /><circle cx="11" cy="12" r=".8" fill="currentColor" /></svg>
}

export function ArrowUpIcon(props: IconProps) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" {...props}><path d="m3.5 9.5 4.5-4.5 4.5 4.5" /></svg>
}

export function ArrowDownIcon(props: IconProps) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" {...props}><path d="m3.5 6.5 4.5 4.5 4.5-4.5" /></svg>
}
