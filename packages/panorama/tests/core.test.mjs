import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { createPanoramaData, parsePanoramaData } from '../dist/react.js'
import { optimizeImage } from '../scripts/optimize-image.mjs'
test('independent defaults, persistence and invalid host data', () => {
  const a=createPanoramaData(),b=createPanoramaData();a.settings.panorama.cardGap=8;assert.equal(b.settings.panorama.cardGap,4)
  assert.deepEqual(parsePanoramaData(JSON.parse(JSON.stringify(a))),a)
  assert.throws(()=>parsePanoramaData({...a,schemaVersion:2}),/версия/)
  for(const source of ['blob:local','data:image/png;base64,abc','javascript:alert(1)']) assert.throws(()=>parsePanoramaData({...a,items:[{id:'a',type:'image',source}]}),/URL/)
  assert.throws(()=>parsePanoramaData({...a,items:[{id:'a',type:'text'},{id:'a',type:'text'}]}),/уникальны/)
})
test('extended panorama controls survive persistence and reject values beyond the new limits', () => {
  const data=createPanoramaData()
  data.settings.panorama={...data.settings.panorama,spanPercent:250,groupCount:7,groupContrast:250}
  data.items=[{id:'a',type:'text',name:'A',caption:'',text:'A',textStyle:'gramatika',aspectRatio:1,sizeGroup:7}]
  assert.deepEqual(JSON.parse(JSON.stringify(parsePanoramaData(JSON.parse(JSON.stringify(data))))),data)
  for(const [key,value] of [['spanPercent',251],['groupCount',8],['groupContrast',251]]) {
    assert.throws(()=>parsePanoramaData({...data,settings:{...data.settings,panorama:{...data.settings.panorama,[key]:value}}}),/диапазона/)
  }
})
test('Sharp prepares arbitrary uploads: max size, alpha, no upscale, orientation',async()=>{
  const large=await sharp({create:{width:2400,height:1200,channels:4,background:{r:200,g:50,b:70,alpha:.5}}}).png().toBuffer()
  const result=await optimizeImage(large)
  assert.equal(result.width,1600);assert.equal(result.height,800)
  assert.equal((await sharp(result.image).metadata()).hasAlpha,true)
  const pixel=await sharp(result.image).raw().toBuffer();assert.ok(pixel[3]>100&&pixel[3]<150)
  assert.equal((await sharp(result.placeholder).metadata()).width,96)
  const small=await sharp({create:{width:40,height:30,channels:3,background:'#ffcc00'}}).jpeg().toBuffer()
  assert.equal((await optimizeImage(small)).width,40)
  const rotated=await sharp({create:{width:80,height:40,channels:3,background:'#778899'}}).jpeg().withMetadata({orientation:6}).toBuffer()
  const upright=await optimizeImage(rotated);assert.equal(upright.width,40);assert.equal(upright.height,80)
})
