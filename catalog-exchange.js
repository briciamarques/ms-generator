/* MS Analysis Exchange 1.0.0. Local files only; no network or account access. */
(function(root){
'use strict';
const VERSION='1.0.0', INSTANCE='supabase:olylsohalgphhxbthyzp', MAX_FILE=20*1024*1024, MAX_TOTAL=100*1024*1024;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail=m=>{throw Error(m);};
const assert=(v,m)=>{if(!v)fail(m);};
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function pathOK(p){return typeof p==='string'&&p.length<240&&!p.includes('\\')&&!p.includes(':')&&!p.startsWith('/')&&!/[\x00-\x1f]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');}
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function zip(files){
 let offset=0;const chunks=[],central=[];
 for(const [name,data] of files){assert(pathOK(name),'Unsafe archive path.');const n=enc.encode(name),c=crc(data),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,c,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,data);
 const d=new Uint8Array(46+n.length),w=new DataView(d.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,c,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);d.set(n,46);central.push(d);offset+=h.length+data.length;
 }
 const length=central.reduce((n,b)=>n+b.length,0),e=new Uint8Array(22),v=new DataView(e.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.size,true);v.setUint16(10,files.size,true);v.setUint32(12,length,true);v.setUint32(16,offset,true);return new Blob([...chunks,...central,e],{type:'application/zip'});
}
async function unzip(blob){
 assert(blob.size<=MAX_TOTAL+1024*1024,'Package exceeds 100 MiB.');const b=new Uint8Array(await blob.arrayBuffer()),v=new DataView(b.buffer);const shared=await import('./vendor/catalog/exchange-core.js');shared.inspectZip(b);let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(v.getUint32(p,true)===0x06054b50){end=p;break;}
 assert(end>=0,'Not a supported ZIP.');assert(end+22+v.getUint16(end+20,true)===b.length,'Invalid ZIP end.');assert(v.getUint16(end+4,true)===0&&v.getUint16(end+6,true)===0,'Multipart ZIP unsupported.');const count=v.getUint16(end+10,true),start=v.getUint32(end+16,true),centralSize=v.getUint32(end+12,true);assert(count>0&&count<=1000&&count===v.getUint16(end+8,true),'Invalid ZIP member count.');assert(start+centralSize===end,'Invalid ZIP directory.');
 const files=new Map(),seen=new Set(),ranges=[];let p=start,total=0;
 for(let i=0;i<count;i++){
 assert(p+46<=end&&v.getUint32(p,true)===0x02014b50,'Invalid ZIP member.');const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),packed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),local=v.getUint32(p+42,true),attrs=v.getUint32(p+38,true),checksum=v.getUint32(p+16,true);assert(p+46+nl+extra+comment<=end,'Truncated ZIP directory.');const name=dec.decode(b.slice(p+46,p+46+nl));p+=46+nl+extra+comment;
 assert(!(flags&1)&&(method===0||method===8),'Encrypted or unsupported ZIP compression.');assert(((attrs>>>16)&0xf000)!==0xa000,'ZIP symlinks are not allowed.');assert(!seen.has(name),'Duplicate ZIP path.');seen.add(name);const directory=name.endsWith('/');assert(pathOK(directory?name.slice(0,-1):name),'Unsafe ZIP path.');assert(size<=(name==='manifest.json'?4*1024*1024:MAX_FILE),'File exceeds exchange limit.');total+=size;assert(total<=MAX_TOTAL,'Expanded package exceeds 100 MiB.');
 assert(local+30<=start&&v.getUint32(local,true)===0x04034b50,'Invalid local ZIP header.');const ln=v.getUint16(local+26,true),le=v.getUint16(local+28,true),dataStart=local+30+ln+le;assert(dataStart+packed<=start,'Truncated ZIP data.');assert(dec.decode(b.slice(local+30,local+30+ln))===name&&v.getUint16(local+8,true)===method&&v.getUint16(local+6,true)===flags,'ZIP headers disagree.');assert(!ranges.some(([a,z])=>local<z&&dataStart+packed>a),'Overlapping ZIP entries.');ranges.push([local,dataStart+packed]);
 let data=b.slice(dataStart,dataStart+packed);
 if(method===8){const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let n=0;try{while(true){const next=await reader.read();if(next.done)break;n+=next.value.length;if(n>size){await reader.cancel();fail('Expanded file exceeds declared size.');}parts.push(next.value);}}finally{reader.releaseLock();}data=new Uint8Array(n);let q=0;for(const part of parts){data.set(part,q);q+=part.length;}}
 assert(data.length===size&&crc(data)===checksum,'ZIP integrity mismatch.');if(directory){assert(!size,'Directory contains data.');continue;}files.set(name,data);
 }
 assert(p===end,'Unexpected ZIP directory data.');return files;
}
function snapshot(s){assert(plain(s)&&uuid(s.id)&&Number.isInteger(s.revision)&&s.revision>0&&typeof s.name==='string'&&plain(s.metadata),'Invalid record snapshot.');}
function checkJsonSafety(value){
 if(Array.isArray(value)){for(const v of value)checkJsonSafety(v);return;}
 if(!plain(value))return;
 for(const [key,v]of Object.entries(value)){
 assert(!['__proto__','constructor','prototype'].includes(key),'Unsafe JSON key.');
 assert(!/^(access_token|refresh_token|service_role|password|authorization|rawBytes|rawData|rawFile|rawFileContent|scanSpectra|individualSpectra)$/i.test(key),'Credentials or RAW/scan payloads are not allowed.');
 if(typeof v==='string')assert(!/^(?:[a-z]:[\\/]|\\\\|data:application\/(?:zip|octet-stream);base64,)/i.test(v),'Local paths or binary dumps are not allowed.');
 checkJsonSafety(v);
 }
}
async function validate(files){
 assert(files.has('manifest.json'),'manifest.json missing.');assert(files.get('manifest.json').length<=4*1024*1024,'Manifest too large.');const m=JSON.parse(dec.decode(files.get('manifest.json')));checkJsonSafety(m);
 assert(m.format==='ms-analysis-exchange'&&m.schemaVersion===VERSION,'Unsupported exchange version. Expected 1.0.0.');assert(['selection','result'].includes(m.kind)&&uuid(m.packageId),'Invalid package kind/ID.');assert(typeof m.createdAt==='string'&&Number.isFinite(Date.parse(m.createdAt))&&m.createdAt.endsWith('Z'),'Invalid creation time.');assert(m.catalog?.instanceId===INSTANCE,'Unsupported Catalog instance.');snapshot(m.catalog.study);assert(Array.isArray(m.requiredFeatures)&&m.requiredFeatures.length===0,'Unsupported required features.');assert(plain(m.extensions)&&typeof m.producer?.version==='string','Invalid producer/extensions.');
 assert(Array.isArray(m.files)&&m.files.length>0&&m.files.length<=999&&Array.isArray(m.inputs)&&m.inputs.length>0&&m.inputs.length<=200,'Invalid files or inputs.');const ids=new Set(),paths=new Set(),byId=new Map();let total=0;
 for(const f of m.files){assert(uuid(f.id)&&!ids.has(f.id)&&pathOK(f.path)&&f.path!=='manifest.json'&&!paths.has(f.path),'Invalid/duplicate file identity.');assert(typeof f.name==='string'&&f.name.length>0&&!/[\\/]/.test(f.name),'Invalid file name.');assert(Number.isInteger(f.size)&&f.size>=0&&f.size<=MAX_FILE&&/^[a-f0-9]{64}$/.test(f.sha256),'Invalid file size/hash.');assert(['input-txt','figure','table','project'].includes(f.role),'Unsupported file role.');const data=files.get(f.path);assert(data&&data.length===f.size,'Missing or incorrect file size.');assert(await sha(data)===f.sha256,'SHA-256 mismatch: '+f.name);total+=data.length;assert(total<=MAX_TOTAL,'Package exceeds expanded limit.');
 if(f.role==='input-txt')assert(f.mime==='text/plain'&&f.path.startsWith('inputs/')&&f.path.endsWith('.txt'),'Invalid TXT descriptor.');
 if(f.role==='figure')assert(f.mime==='image/png'&&f.path.endsWith('.png')&&data.slice(0,8).join(',')==='137,80,78,71,13,10,26,10','Only PNG figures are supported in Catalog v1.');
 if(f.role==='table')assert(f.mime==='text/csv'&&f.path.endsWith('.csv'),'Invalid CSV descriptor.');
 if(f.role==='project'){assert(f.mime==='application/json'&&f.path.endsWith('.json'),'Unsupported editable project type.');checkJsonSafety(JSON.parse(dec.decode(data)));}
 if(f.role==='input-txt'||f.role==='table')assert(!dec.decode(data).includes('\u0000'),'Invalid text file.');
 ids.add(f.id);paths.add(f.path);byId.set(f.id,f);
 }
 assert(files.size===m.files.length+1,'Undeclared ZIP members.');const inputs=new Set(),txtIds=new Set();
 for(const input of m.inputs){snapshot(input.spectrum);snapshot(input.experiment);snapshot(input.molecule);assert(uuid(input.inputId)&&input.inputId===input.spectrum.id&&!inputs.has(input.inputId),'Invalid/duplicate input ID.');assert(input.columns?.join(',')==='mz,intensity','Unsupported input columns.');const f=byId.get(input.txtFileId);assert(f?.role==='input-txt'&&!txtIds.has(f.id)&&input.storedTxt?.mime==='text/plain'&&f.sha256===input.storedTxt.sha256&&f.size===input.storedTxt.size,'Input source/hash mismatch.');assert(['original','base-peak-relative','normalized-other','unknown'].includes(input.intensity?.state),'Invalid intensity state.');assert(['catalog','xcalibur-confirmed','imported','unknown'].includes(input.processing?.origin),'Invalid processing origin.');assert(['unreviewed','reviewed'].includes(input.replication?.status)&&Array.isArray(input.assignments)&&plain(input.extensions),'Invalid input provenance.');inputs.add(input.inputId);txtIds.add(f.id);}
 assert(m.files.filter(f=>f.role==='input-txt').length===txtIds.size,'Unreferenced input file.');
 if(m.kind==='selection'){assert(m.producer.app==='ms-catalog'&&m.selection?.intendedEditor==='ms-generator','This selection is not for MS Generator.');const order=m.selection.orderedInputIds;assert(Array.isArray(order)&&order.length===inputs.size&&new Set(order).size===inputs.size&&order.every(id=>inputs.has(id)),'Invalid selection order.');assert(m.files.every(f=>f.role==='input-txt'),'Selection contains result files.');}
 else {
 const r=m.result;assert(m.producer.app==='ms-generator'&&r?.editor?.app==='ms-generator','Reopen this result in its original editor.');assert(uuid(r.resultId)&&uuid(r.versionId)&&(r.previousVersionId===null||uuid(r.previousVersionId))&&r.previousVersionId!==r.versionId,'Invalid result lineage.');assert(typeof r.title==='string'&&r.title.trim()&&['spectrum-figure','spectrum-comparison','other'].includes(r.analysisType),'Unsupported result.');assert(uuid(m.selectionReceipt?.packageId)&&/^[a-f0-9]{64}$/.test(m.selectionReceipt.manifestSha256),'Invalid selection receipt.');assert(Array.isArray(r.usedInputIds)&&r.usedInputIds.length===inputs.size&&new Set(r.usedInputIds).size===inputs.size&&r.usedInputIds.every(id=>inputs.has(id)),'Result inputs do not match.');
 const a=r.artifacts;assert(a?.project?.editor==='ms-generator'&&a.project.formatId==='ms-generator-project'&&a.project.formatVersion==='2'&&byId.get(a.project.fileId)?.role==='project','Unsupported MS Generator project format.');assert(Array.isArray(a.project.datasetBindings)&&a.project.datasetBindings.length>0,'Missing dataset bindings.');const datasets=new Set();for(const b of a.project.datasetBindings){assert(typeof b.datasetId==='string'&&!datasets.has(b.datasetId)&&Array.isArray(b.inputIds)&&b.inputIds.length===1&&inputs.has(b.inputIds[0]),'Invalid dataset bindings.');datasets.add(b.datasetId);}
 assert(Array.isArray(a.figureFileIds)&&a.figureFileIds.length>0&&a.figureFileIds.every(id=>byId.get(id)?.role==='figure'),'Missing PNG figure.');assert(Array.isArray(a.tables)&&a.tables.length>0&&a.tables.every(t=>byId.get(t.fileId)?.role==='table'&&t.lineageColumns?.seriesId&&t.lineageColumns?.inputIds),'Missing traceable CSV table.');
 }
 const shared = await import("./vendor/catalog/exchange-core.js");
 await shared.validateExchange(m, Object.fromEntries(files));
 return m;
}
const api={VERSION,INSTANCE,MAX_FILE,MAX_TOTAL,enc,dec,sha,uuid,assert,checkJsonSafety,zip,unzip,validate};root.MSCatalogExchange=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);