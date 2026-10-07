const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const server=http.createServer((q,r)=>{const js=q.url==='/comparison.js';r.setHeader('Content-Type',js?'application/javascript':'text/html');r.end(fs.readFileSync(path.join(__dirname,js?'../comparison.js':'../index.html')));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>document.getElementById('plot')._fullLayout);
await p.evaluate(()=>{spectrumSlots=[{...defaultSpectrumSlot(0),data:'257.1 100\n274.3 30\n274.8 40'},{...defaultSpectrumSlot(1),data:'257.1 90\n274.3 35\n274.8 50'}];activeSpectrumId=spectrumSlots[0].id;refreshSpectrumControls();renderPlot();});
await p.waitForTimeout(400);
async function geometry(){return p.evaluate(()=>{const plot=document.getElementById('plot'),rect=plot.getBoundingClientRect();return {width:plot._fullLayout.width,height:plot._fullLayout.height,ratio:rect.width/rect.height,labels:[...plot.querySelectorAll('.annotation-text')].map(el=>{const r=el.getBoundingClientRect();return [(r.x-rect.x)/rect.width,(r.y-rect.y)/rect.height,r.width/rect.width,r.height/rect.height];})};});}
const baseline=await geometry();assert(baseline.labels.length>0);
for(const [width,height,final] of [[1440,900,true],[1280,720,false],[1280,720,true],[1920,1080,false],[390,844,false]]){
 await p.setViewportSize({width,height});await p.evaluate(final=>{document.getElementById('previewExport').checked=final;updateFinalSizePreview(true);},final);await p.waitForTimeout(350);
 const current=await geometry();assert.equal(current.width,baseline.width);assert.equal(current.height,baseline.height);assert(Math.abs(current.ratio-baseline.ratio)<0.001);assert.equal(current.labels.length,baseline.labels.length);
 current.labels.forEach((label,i)=>label.forEach((v,j)=>assert(Math.abs(v-baseline.labels[i][j])<0.002,'label geometry changed')));
 if(width>1050)assert(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'page overflow');
}
assert.deepEqual(errors,[]);console.log('PASS: stacked spectra retain canonical dimensions, aspect ratio and proportional label geometry across preview modes and viewport sizes.');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});