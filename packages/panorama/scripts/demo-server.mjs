// Local integration harness only. Production teams supply authenticated adapters.
import http from 'node:http'
import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { createPanoramaData, parsePanoramaData } from '../dist/react.js'
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const store = process.env.PANORAMA_DEMO_DATA_DIR || path.join(root, '.demo-data')
await mkdir(path.join(store, 'media'), { recursive: true })
await mkdir(path.join(store, 'blocks'), { recursive: true })
const port = Number(process.env.PANORAMA_DEMO_PORT || 5196)
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.ttf':'font/ttf','.otf':'font/otf' }
async function body(request, limit) {
  const chunks=[]; let size=0
  for await (const chunk of request) { size+=chunk.length; if(size>limit) throw new Error('File too large'); chunks.push(chunk) }
  return Buffer.concat(chunks)
}
function json(response, value, status=200) { response.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'}); response.end(JSON.stringify(value)) }
async function save(file, data) { const temp=`${file}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(data,null,2)); await rename(temp,file) }
const server=http.createServer(async(request,response)=>{
  try {
    if(request.headers.origin && request.headers.origin!==`http://127.0.0.1:${port}` && request.headers.origin!==`http://localhost:${port}` && request.headers.origin!=='http://127.0.0.1:5197') return json(response,{error:'Cross-origin writes disabled'},403)
    const url=new URL(request.url,`http://127.0.0.1:${port}`)
    if(url.pathname==='/api/media' && request.method==='POST') {
      const type=request.headers['content-type']
      const ext={'image/webp':'.webp','video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov','video/x-m4v':'.mp4'}[type]
      if(!ext) return json(response,{error:'Unsupported media type'},415)
      const bytes=await body(request,128*1024*1024)
      if(type==='image/webp') { const meta=await sharp(bytes).metadata(); if(meta.format!=='webp'||meta.width>1600||meta.height>1600) throw new Error('Expected prepared WebP <=1600px') }
      const name=randomUUID()+ext; await writeFile(path.join(store,'media',name),bytes)
      return json(response,{url:`/demo-media/${name}`})
    }
    const match=url.pathname.match(/^\/api\/blocks\/([a-zA-Z0-9_-]+)\/(draft|published)$/)
    if(match) {
      const file=path.join(store,'blocks',`${match[1]}-${match[2]}.json`)
      if(request.method==='GET') { try { return json(response,JSON.parse(await readFile(file,'utf8'))) } catch(error) { if(error.code==='ENOENT') return json(response,createPanoramaData()); throw error } }
      if(request.method==='PUT') { const data=parsePanoramaData(JSON.parse((await body(request,4*1024*1024)).toString())); await save(file,data); return json(response,{ok:true}) }
    }
    if(!['GET','HEAD'].includes(request.method)) return json(response,{error:'Not found'},404)
    let relative=decodeURIComponent(url.pathname)
    if(relative==='/') relative='/examples/html/index.html'
    let base=root
    if(relative.startsWith('/demo-media/')) { base=path.join(store,'media'); relative=relative.slice('/demo-media'.length) }
    else if(!relative.startsWith('/dist/')&&!relative.startsWith('/examples/html/')) return json(response,{error:'Not found'},404)
    const file=path.resolve(base,'.'+relative)
    if(!file.startsWith(base+path.sep)) return json(response,{error:'Forbidden'},403)
    const info=await stat(file); if(!info.isFile()) return json(response,{error:'Not found'},404)
    const range=request.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
    const start=range?Number(range[1]):0, end=range&&range[2]?Math.min(Number(range[2]),info.size-1):info.size-1
    if(start>end||start>=info.size) {response.writeHead(416);return response.end()}
    response.writeHead(range?206:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Cache-Control':'no-store','Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{})})
    if(request.method==='HEAD') return response.end()
    createReadStream(file,{start,end}).pipe(response)
  } catch(error) { if(!response.headersSent) json(response,{error:error.code==='ENOENT'?'Not found':error.message},error.code==='ENOENT'?404:400); else response.destroy() }
})
server.listen(port,'127.0.0.1',()=>console.log(`Panorama demo: http://127.0.0.1:${port} (local data: .demo-data)`))
