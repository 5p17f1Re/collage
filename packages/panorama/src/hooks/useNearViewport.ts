import { useEffect, useRef, useState } from 'react'
export function useNearViewport<T extends Element>(eager = false) {
  const ref = useRef<T>(null)
  const [ready, setReady] = useState(eager)
  useEffect(() => {
    if (eager) { setReady(true); return }
    if (ready || !ref.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setReady(true); observer.disconnect() }
    }, { rootMargin: '300px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [eager, ready])
  return { ref, ready: ready || eager }
}
