const assert = require('node:assert/strict');
const c = require('../comparison.js');
const spectra = [
 { name: 'X', peaks: [{mz:100,intensity:10},{mz:100.004,intensity:20},{mz:200,intensity:0},{mz:300,intensity:0.00000001}] },
 { name: 'Y', peaks: [{mz:100.008,intensity:5},{mz:100.016,intensity:15},{mz:400,intensity:-2}] }
];
let rows = c.buildRows(spectra,0.01);
assert.equal(rows.length,3); // No chaining from 100 through 100.008 to 100.016.
assert.equal(rows[0].cells[0].intensity,20);
assert.equal(rows[0].cells[0].count,2);
assert.equal(rows[1].cells[0],null);
assert.equal(rows[2].mz,300);
assert.equal(c.buildRows(spectra,0).length,5);
assert.equal(c.buildRows(spectra,100,'ppm').length,3);
assert.throws(()=>c.buildRows(spectra,-1));
assert.throws(()=>c.buildRows(spectra,NaN));
const relative=c.matrix(spectra,rows,'relative');
assert.equal(relative[1][1],'100');
assert.equal(relative[2][2],'100');
assert.notEqual(relative[3][1],'0');
assert.equal(c.matrix(spectra,rows,'presence')[1][2],'✓');
assert.equal(c.matrix(spectra,rows,'raw')[2][1],'—');
assert(c.serialize([['a,b','say "yes"']],',').includes('"say ""yes"""'));
assert(c.serialize([['=formula']],',').startsWith("'="));
assert.equal(c.buildRows([],0).length,0);
// The cutoff is inclusive, per spectrum, and applied before mass grouping.
const cutoffSpectra = [
 {name:'A', peaks:[{mz:100,intensity:4},{mz:100.006,intensity:10},{mz:200,intensity:100},{mz:300,intensity:5},{mz:-1,intensity:10000}]},
 {name:'B', peaks:[{mz:100.012,intensity:1},{mz:200,intensity:10},{mz:300,intensity:0.49}]}
];
const filtered = c.buildRows(cutoffSpectra,0.01,'da',5,'relative');
assert.deepEqual(filtered.map(r=>r.mz),[100.006,200,300]);
assert.equal(filtered[0].cells[0].count,1);
assert.equal(filtered[0].cells[1].intensity,1);
assert.equal(filtered[2].cells[0].intensity,5);
assert.equal(filtered[2].cells[1],null);
assert.deepEqual(c.matrix(cutoffSpectra,filtered,'relative')[1],['100.006','10','10']);
assert.equal(c.buildRows(cutoffSpectra,0,'da',100,'relative').length,1);
assert.equal(c.buildRows(cutoffSpectra,0,'da',101,'raw').length,0);
assert.deepEqual(c.buildRows(cutoffSpectra,0,'da',5,'raw').map(r=>r.mz),[100.006,200,300]);
assert.deepEqual(c.buildRows(cutoffSpectra),c.buildRows(cutoffSpectra,0,'da',0,'relative'));
assert.equal(c.buildRows([{name:'Empty',peaks:[]}],0,'da',5).length,0);
for (const invalid of [-1,NaN,Infinity]) assert.throws(()=>c.buildRows(cutoffSpectra,0,'da',invalid));
assert.throws(()=>c.buildRows(cutoffSpectra,0,'da',101,'relative'));
assert(c.serialize(c.matrix(cutoffSpectra,filtered,'raw'),',').includes('100.006,10,1'));
console.log('PASS: exact/absolute/ppm matching; no chain merging; duplicate max; missing/zero/negative; normalization; tiny intensities; CSV escaping.');
console.log('PASS: relative/original intensity cutoffs; inclusive boundary; filter before grouping; original normalization; empty results; validation; filtered export.');
