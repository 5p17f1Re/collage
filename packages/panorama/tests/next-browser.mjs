import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import sharp from 'sharp'
const browser=await chromium.launch({headless:true,...(process.env.PANORAMA_BROWSER_CHANNEL?{channel:process.env.PANORAMA_BROWSER_CHANNEL}:{})})
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5197');await page.locator('.panorama-editor').waitFor()
 const png=await sharp({create:{width:800,height:600,channels:3,background:'#b0b070'}}).png().toBuffer()
 await page.locator('input[type=file]').first().setInputFiles({name:'next-test.png',mimeType:'image/png',buffer:png})
 await page.waitForFunction(()=>document.querySelector('.editor-items li'))
 await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Черновик сохранён'}).waitFor()
 await page.getByRole('button',{name:'Опубликовать',exact:true}).click()
 await page.locator('.collage-stage').waitFor();await page.locator('.panorama-frame').scrollIntoViewIfNeeded();await page.waitForTimeout(500)
 assert.deepEqual(errors,[]);console.log('Next.js production render, hydration, upload, save and publish: PASS; no page errors')
}finally{await browser.close()}
