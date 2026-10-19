// Read-only checks of the current application, without browser or user storage.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const comparison = require('../comparison.js');
function extract(name, next) {
  const start = html.indexOf(`    function ${name}(`);
  const end = html.indexOf(`    function ${next}(`, start);
  if (start < 0 || end < 0) throw new Error(`Missing function: ${name}`);
  return html.slice(start, end);
}
const controls = {normalize:{checked:true},showDots:{checked:true},peakLineWidth:{value:'0.65'}};
const context = vm.createContext({$: id => controls[id], formatPlotText: x => x, linePtToPlotlyPx: x => Number(x), getAxisId: (p,i) => i ? p+(i+1) : p});
for (const pair of [['parseSpectrum','getSpectra'],['normalizePeaks','axisDomain'],['makePeakTrace','getYScale']]) {
  vm.runInContext(extract(...pair), context);
}
function run(code) { return JSON.parse(JSON.stringify(vm.runInContext(code, context))); }
const probes = {
  decimalComma: run('parseSpectrum("100,5;20,5")'),
  emptyColumn: run('parseSpectrum("100,,25")'),
  quotedCsv: run('parseSpectrum(\'"100.5","20.5"\')'),
  dotDecimal: run('parseSpectrum("100.5,20.5")'),
  nonPositiveValues: run('parseSpectrum("-10 5\\n100 -2\\n0 1")'),
  normalizedBelowOne: run('normalizePeaks([{mz:100,intensity:0.2},{mz:200,intensity:0.5}])'),
  normalizedZeros: run('normalizePeaks([{mz:100,intensity:0}])'),
  comparisonNormalized: comparison.matrix([{name:'Sample',peaks:[{mz:100,intensity:0.2},{mz:200,intensity:0.5}]}], comparison.buildRows([{peaks:[{mz:100,intensity:0.2},{mz:200,intensity:0.5}]}]), 'relative')
};
controls.normalize.checked = false;
probes.rawHover = run('makePeakTrace({name:"Sample",color:"#000000",peaks:[{mz:100,intensity:250}]},0,1,2,0).map(t=>t.hovertemplate)');
const projectControls = {savedProjectSelect:{value:'project-a'},projectName:{value:'Project A'},chartTitle:{value:''},status:{textContent:''}};
let writtenProjects;
const saveContext = vm.createContext({
  $: id => projectControls[id],
  readProjects: () => [{id:'project-a',name:'Project A',data:'original data A'}],
  projectFromForm: (name,id) => ({id,name,data:'current unsaved data B'}),
  writeProjects: projects => { writtenProjects = projects; },
  updateProjectButtons: () => {},
  t: key => key === 'newProject' ? 'New project' : name => `${key}: ${name}`
});
vm.runInContext(extract('saveProject','loadProject'),saveContext);
vm.runInContext('saveProject()',saveContext);
probes.saveAfterSelectingWithoutOpening = writtenProjects;
for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
new vm.Script(fs.readFileSync(path.join(root,'comparison.js'),'utf8'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const result = {
  checkedAt: new Date().toISOString(),
  sha256: crypto.createHash('sha256').update(html).digest('hex'),
  syntax: 'PASS',
  duplicateHtmlIds: [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))],
  probes,
  scope: 'Pure functions extracted from the current source; no browser rendering or user storage accessed.'
};
fs.writeFileSync(path.join(__dirname,'evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
