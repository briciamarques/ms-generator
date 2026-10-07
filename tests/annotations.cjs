const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const assert = require('assert/strict');
const source = require('path').join(__dirname, '../index.html');
const server = http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(source));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.getElementById('plot')._fullLayout,{timeout:45000});
 await page.locator('#ptBtn').click();
 await page.locator('[data-tab="annotations"]').click();
 await page.locator('#customAnnotationText').fill('Texto livre\nSegunda linha');
 await page.locator('#placeCustomAnnotation').click();
 const point=await page.evaluate(()=>{const p=document.getElementById('plot'),r=p.getBoundingClientRect(),l=p._fullLayout;return {x:r.left+l.margin.l+0.5*(l.width-l.margin.l-l.margin.r),y:r.top+l.margin.t+0.3*(l.height-l.margin.t-l.margin.b)};});
 await page.mouse.click(point.x,point.y);
 await page.waitForFunction(()=>customAnnotations.length===1 && renderedCustomAnnotations.size===1);
 await page.waitForTimeout(400);
 const initial=await page.evaluate(()=>({...customAnnotations[0]}));
 const idx=await page.evaluate(()=>[...renderedCustomAnnotations.keys()][0]);
 const label=page.locator(`.annotation[data-index="${idx}"] .annotation-text`);
 const box=await label.boundingBox();assert(box);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();await page.mouse.move(box.x+box.width/2+55,box.y+box.height/2+30,{steps:12});await page.mouse.up();
 await page.waitForTimeout(600);
 const moved=await page.evaluate(()=>({...customAnnotations[0]}));
 assert(Math.abs(moved.x-initial.x)>0.01,'drag persists x');
 await page.evaluate(()=>{selectedCustomAnnotationId=null;});
 const clickBox=await label.boundingBox(); await page.mouse.click(clickBox.x+clickBox.width/2,clickBox.y+clickBox.height/2);
 await page.waitForFunction(()=>selectedCustomAnnotationId===customAnnotations[0].id);
 await page.locator('#customAnnotationText').fill('Pico principal');
 await page.locator('#customAnnotationArrow').check();
 await page.locator('#applyAnnotation').click();
 await page.waitForTimeout(500);
 assert(await page.evaluate(()=>customAnnotations[0].showarrow));
 assert.equal(await page.evaluate(()=>customAnnotations[0].text),'Pico principal');
 const arrows=await page.locator('.custom-user-annotation .annotation-arrow-g path').evaluateAll(ps=>ps.map(p=>getComputedStyle(p).display));
 assert(arrows.length>0 && arrows.every(d=>d!=='none'),'arrow visible');
 // Arrow text drag changes pixel offsets while its target stays anchored.
 const beforeArrow = await page.evaluate(()=>({...customAnnotations[0]}));
 const arrowBox = await label.boundingBox();
 await page.mouse.move(arrowBox.x+arrowBox.width/2,arrowBox.y+arrowBox.height/2);
 await page.mouse.down();await page.mouse.move(arrowBox.x+arrowBox.width/2+35,arrowBox.y+arrowBox.height/2-20,{steps:10});await page.mouse.up();
 await page.waitForTimeout(500);
 const afterArrow = await page.evaluate(()=>({...customAnnotations[0]}));
 assert.equal(afterArrow.x,beforeArrow.x);
 assert.notEqual(afterArrow.ax,beforeArrow.ax);
 await page.locator('#projectName').fill('Annotation QA');await page.locator('#saveProject').click();
 await page.locator('[data-action="delete"]').click();
 assert.equal(await page.evaluate(()=>customAnnotations.length),0);
 await page.locator('#undoAnnotation').click();
 assert.equal(await page.evaluate(()=>customAnnotations.length),1);
 await page.locator('#loadProject').click();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>customAnnotations[0].text),'Pico principal');
 assert.equal(await page.evaluate(()=>customAnnotations[0].x),moved.x);
 const svg=await page.evaluate(()=>Plotly.toImage('plot',{format:'svg',width:1000,height:600}));
 assert(decodeURIComponent(svg).includes('Pico principal'),'export text');

 // Blank m/z override must use the clicked position rather than zero.
 await page.locator('#customAnnotationText').fill('Data anchor');
 await page.locator('#customAnnotationMode').selectOption('data');
 await page.locator('#placeCustomAnnotation').click();
 await page.mouse.click(point.x,point.y);
 await page.waitForFunction(()=>customAnnotations.length===2);
 assert(await page.evaluate(()=>customAnnotations[1].x>200));
 // Filtered spectra must not shift the rendered ID mapping onto another annotation.
 await page.evaluate(()=>{customAnnotations.push(normalizeCustomAnnotation({id:'hidden',originalText:'Hidden',mode:'data',spectrumId:'missing',x:300,y:50}));renderPlot();});
 await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>renderedCustomAnnotations.size),2);
 assert.deepEqual(errors,[]);
 console.log('PASS: real browser placement, multiline text, drag persistence, edit, visible arrow, delete/undo, project reload, SVG export; no browser errors.');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
