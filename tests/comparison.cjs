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
console.log('PASS: exact/absolute/ppm matching; no chain merging; duplicate max; missing/zero/negative; normalization; tiny intensities; CSV escaping.');