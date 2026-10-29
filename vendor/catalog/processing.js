export const VERSION = 'ms-catalog/1.0.0';
const finite = Number.isFinite;
export function parseTxt(text) {
 const peaks=[],errors=[];
 text.replace(/^\uFEFF/,'').split(/\r?\n/).forEach((line,i)=>{
  if(!line.trim())return;
  const v=line.trim().split(/[\s,;]+/).map(Number);
  if(v.length!==2||!v.every(finite)||v[0]<=0||v[1]<0)errors.push(i+1);else peaks.push(v);
 });
 if(errors.length)throw Error('Invalid TXT rows: '+errors.slice(0,12).join(', ')+'. Expected two numeric columns. No rows discarded.');
 if(!peaks.length)throw Error('TXT contains no spectrum.');
 if(peaks.some((p,i)=>i&&p[0]<=peaks[i-1][0]))throw Error('TXT m/z must be strictly increasing. Sort or resolve duplicates before importing.');
 return peaks;
}
export const toTxt=peaks=>peaks.map(p=>p[0]+'\t'+p[1]).join('\n')+'\n';
export function validateScan(s){
 if(!['profile','centroid'].includes(s.mode))throw Error('Unknown representation.');
 if((s.mode==='profile'&&s.peaks.length<2)||s.peaks.some((p,i)=>!p.every(finite)||p[0]<=0||p[1]<0||(i&&p[0]<=s.peaks[i-1][0])))throw Error('Invalid or unsorted scan arrays.');
 if(!s.range||!s.range.every(finite)||s.range[0]>=s.range[1])throw Error('Acquired m/z range is required.');
}
export const compatibility=s=>JSON.stringify([s.sourceId,s.mode,s.msLevel,s.polarity,s.precursors,s.activation,s.filter,s.instrumentId]);
export function selectScans(scans,{numbers='',startSeconds=null,endSeconds=null,excluded={}}={}){
 const ranges=numbers.trim()?numbers.split(',').map(x=>{
  const m=x.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if(!m||+m[1]<1||+(m[2]||m[1])<+m[1])throw Error('Use scan numbers such as 1-10, 14.');
  return [+m[1],+(m[2]||m[1])];
 }):[];
 if(startSeconds!==null&&!finite(startSeconds)||endSeconds!==null&&!finite(endSeconds))throw Error('Invalid retention time.');
 if(startSeconds!==null&&endSeconds!==null&&startSeconds>endSeconds)throw Error('Retention start exceeds end.');
 for(const [id,reason] of Object.entries(excluded))if(!reason.trim())throw Error('Exclusion '+id+' needs a reason.');
 return scans.filter(s=>(!ranges.length||ranges.some(([a,b])=>s.number>=a&&s.number<=b))&&(startSeconds===null||s.timeSeconds!==null&&s.timeSeconds>=startSeconds)&&(endSeconds===null||s.timeSeconds!==null&&s.timeSeconds<=endSeconds)&&!(s.id in excluded));
}
function lower(points,mz){let a=0,b=points.length;while(a<b){const m=(a+b)>>>1;if(points[m][0]<mz)a=m+1;else b=m;}return a;}
export function interpolate(points,mz){
 const i=lower(points,mz);if(i<points.length&&points[i][0]===mz)return points[i][1];
 if(i===0||i===points.length)return null;
 const [x,y]=points[i-1],[xx,yy]=points[i];return y+(yy-y)*(mz-x)/(xx-x);
}
export function average(scans,options={}){
 if(!scans.length)throw Error('Select at least one scan.');scans.forEach(validateScan);
 if(new Set(scans.map(compatibility)).size!==1)throw Error('Incompatible scans: select one RAW and one acquisition-condition group.');
 const mode=scans[0].mode,tol=options.tolerance??0.05,unit=options.unit??'Da',normalization=options.normalization??'none';
 if(!finite(tol)||tol<=0||!['Da','ppm'].includes(unit))throw Error('Set a positive Da or ppm tolerance.');
 if(!['none','basepeak-after'].includes(normalization))throw Error('Unsupported normalization.');
 let peaks=[],denominators=[],domain=null;
 if(mode==='profile'){
  const lo=Math.max(...scans.map(s=>Math.max(s.range[0],s.peaks[0][0]))),hi=Math.min(...scans.map(s=>Math.min(s.range[1],s.peaks.at(-1)[0])));
  if(lo>=hi)throw Error('No common profile support.');domain=[lo,hi];
  const grid=scans[0].peaks.filter(p=>p[0]>=lo&&p[0]<=hi).map(p=>p[0]);if(!grid.length)throw Error('No reference-grid samples in common support.');
  peaks=grid.map(x=>[x,scans.reduce((sum,s)=>sum+interpolate(s.peaks,x),0)/scans.length]);denominators=grid.map(()=>scans.length);
 }else{
  const all=scans.flatMap((s,i)=>s.peaks.map(([x,y])=>({x,y,i}))).sort((a,b)=>a.x-b.x);
  for(let k=0;k<all.length;){
   const anchor=all[k].x,limit=anchor+(unit==='ppm'?anchor*tol/1e6:tol),sums=new Map();let last=anchor;
   while(k<all.length&&all[k].x<=limit){const p=all[k++];last=p.x;sums.set(p.i,(sums.get(p.i)||0)+p.y);}
   const eligible=scans.map((s,i)=>s.range[0]<=anchor&&s.range[1]>=last?i:null).filter(i=>i!==null);
   if(!eligible.length)throw Error('Cluster outside acquired ranges.');
   peaks.push([anchor,eligible.reduce((sum,i)=>sum+(sums.get(i)||0),0)/eligible.length]);denominators.push(eligible.length);
  }
 }
 if(!peaks.length)throw Error('No peaks in selected scans. No spectrum can be exported.');
 const originals=peaks.map(p=>[...p]);let scale=1;
 if(normalization==='basepeak-after'){const max=peaks.reduce((m,p)=>Math.max(m,p[1]),0);scale=max?100/max:1;peaks=peaks.map(([x,y])=>[x,y*scale]);}
 return {peaks,originals,denominators,recipe:{processor:VERSION,mode,method:mode==='profile'?'linear interpolation onto first selected scan grid, common support':'sorted anchored non-chaining clusters; sum within scan then scan mean',tolerance:mode==='centroid'?{value:tol,unit}:null,referenceScan:mode==='profile'?scans[0].id:null,domain,denominator:mode==='profile'?'all selected scans':'scans covering full observed cluster; absent peak = 0',normalization,normalizationStage:'after mean only',scale,scanIds:scans.map(s=>s.id),scanNumbers:scans.map(s=>s.number),sourceId:scans[0].sourceId,noFilters:true}};
}
export function ionStatistics(scans,targets,{window=0.5,threshold=0}={}){
 if(!finite(window)||window<=0||!finite(threshold)||threshold<0)throw Error('Use a positive ion half-window and nonnegative detection threshold.');
 if(targets.some(x=>!finite(x)||x<=0))throw Error('Invalid ion m/z.');
 return targets.map(target=>{
  const lo=target-window,hi=target+window;
  const series=scans.map(s=>{
   let value=null;
   if(s.range[0]<=lo&&s.range[1]>=hi){
    const points=s.peaks.slice(lower(s.peaks,lo),lower(s.peaks,hi));
    if(s.mode==='centroid')value=points.reduce((sum,p)=>sum+p[1],0);
    else{const a=interpolate(s.peaks,lo),b=interpolate(s.peaks,hi);if(a!==null&&b!==null)value=points.reduce((m,p)=>Math.max(m,p[1]),Math.max(a,b));}
   }
   return {scanId:s.id,scanNumber:s.number,retentionSeconds:s.timeSeconds,intensity:value,detected:value===null?null:value>threshold};
  });
  const values=series.map(x=>x.intensity).filter(x=>x!==null),n=values.length,mean=n?values.reduce((a,b)=>a+b,0)/n:null;
  const sd=n>1?Math.sqrt(values.reduce((sum,x)=>sum+(x-mean)**2,0)/(n-1)):null,detected=series.filter(x=>x.detected===true).length;
  return {target,mean,sampleSD:sd,cvPercent:n>1&&mean>0?100*sd/mean:null,n,selectedScans:scans.length,detected,frequency:n?detected/n:null,series,definition:{label:'Variability between scans — not independent experimental replicates',basis:'original extracted intensities',window:[lo,hi],windowRule:'centroid [low, high); profile maximum including interpolated boundaries',extraction:scans[0]?.mode==='profile'?'profile peak height':'sum of centroid intensities',detection:'intensity > '+threshold,missing:'within acquired window = 0; incomplete window or profile support = null, excluded from n',normalization:'none'}};
 });
}

