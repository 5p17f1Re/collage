async function request(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || `HTTP ${response.status}`) }
  return response.json()
}
export function loadDraft(blockId) { return request(`/api/blocks/${encodeURIComponent(blockId)}/draft`) }
export function loadPublished(blockId) { return request(`/api/blocks/${encodeURIComponent(blockId)}/published`) }
export const adapter = {
  async uploadMedia(media, { signal }) {
    const upload = async file => file ? (await request('/api/media', { method:'POST', headers:{'Content-Type':file.type}, body:file, signal })).url : undefined
    return { source:await upload(media.file), placeholder:await upload(media.placeholder), poster:await upload(media.poster) }
  },
  async saveDraft(blockId, data, { signal }) {
    await request(`/api/blocks/${encodeURIComponent(blockId)}/draft`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal})
  },
  async publish(blockId, data, { signal }) {
    await request(`/api/blocks/${encodeURIComponent(blockId)}/published`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal})
    window.dispatchEvent(new CustomEvent('panorama-published',{detail:{blockId}}))
  }
}
