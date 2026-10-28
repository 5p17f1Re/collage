let depth = 0
let overflow = ''
export function lockPageScroll() {
  if (depth++ === 0) { overflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  let released = false
  return () => { if (!released) { released = true; if (--depth === 0) document.body.style.overflow = overflow } }
}
