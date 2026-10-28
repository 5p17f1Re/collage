'use client'
import { useEffect, useState } from 'react'
import { Panorama, PanoramaEditor, createPanoramaData } from '@avgvst/panorama'
import type { EditorAdapter, PanoramaData } from '@avgvst/panorama'
async function request(url:string,options:RequestInit={}) { const response=await fetch(url,options); if(!response.ok) throw new Error(`HTTP ${response.status}`);return response.json() }
export default function Example() {
 const [draft,setDraft]=useState<PanoramaData|null>(null), [published,setPublished]=useState(createPanoramaData),[error,setError]=useState('')
 useEffect(()=>{Promise.all([request('/api/blocks/next/draft'),request('/api/blocks/next/published')]).then(([d,p])=>{setDraft(d);setPublished(p)}).catch(e=>setError(e.message))},[])
 const adapter:EditorAdapter={
  async uploadMedia(media,{signal}){const upload=async(file?:File)=>file?(await request('/api/media',{method:'POST',headers:{'Content-Type':file.type},body:file,signal})).url:undefined;return {source:await upload(media.file),placeholder:await upload(media.placeholder),poster:await upload(media.poster)}},
  async saveDraft(id,data,{signal}){await request(`/api/blocks/${id}/draft`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal})},
  async publish(id,data,{signal}){await request(`/api/blocks/${id}/published`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal});setPublished(data)}
 }
 return <><Panorama data={published}/>{error&&<p role="alert">Запустите локальный demo-сервер: {error}</p>}{draft&&<PanoramaEditor blockId="next" initialData={draft} adapter={adapter}/>}</>
}
