const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
new vm.Script(script);
const slots = [{ id: "off", name: "OFF" }, { id: "on", name: "290 nm" }];
let renders = 0;
const ctx = vm.createContext({
 spectrumSlots: slots,
 renderedNameAnnotations: new Map([[5, { spectrumId: "on", domain: [0.2, 0.4] }]]),
 activeSpectrum: () => slots.find(s => s.id === "on"),
 renderPlot: () => renders++
});
for (const name of ["insideNamePosition", "saveInsideNamePosition", "resetInsideNamePositions"]) {
 const start = script.indexOf("    function " + name + "(");
 const end = script.indexOf("\n    function ", start + 1);
 assert(start >= 0 && end > start);
 vm.runInContext(script.slice(start, end), ctx);
}
const close = (a,b) => assert(Math.abs(a-b) < 1e-10, a + " vs " + b);
const on = slots[1];
assert.equal(ctx.saveInsideNamePosition(5, "x", 0.85), true);
assert.equal(ctx.saveInsideNamePosition(5, "y", 0.38), true);
let pos = ctx.insideNamePosition(on, [0.2, 0.4], 0.02, 0.92);
close(pos.x, 0.85); close(pos.y, 0.38);
assert.equal(slots[0].insideNamePosition, undefined);
pos = ctx.insideNamePosition(on, [0.6, 0.9], 0.1, 0.5);
close(pos.x, 0.85); close(pos.y, 0.87); // Same relative position after reorder/resize.
const reopened = JSON.parse(JSON.stringify(on));
pos = ctx.insideNamePosition(reopened, [0.6, 0.9], 0.02, 0.92);
close(pos.x, 0.85); close(pos.y, 0.87);
slots.reverse();
assert.equal(ctx.saveInsideNamePosition(5, "x", 0.7), true);
close(on.insideNamePosition.x, 0.7); // ID, not list index.
assert.equal(ctx.saveInsideNamePosition(0, "x", 0.5), false); // Unrelated peak annotation.
assert.equal(ctx.saveInsideNamePosition(5, "ax", 10), false);
assert.equal(ctx.saveInsideNamePosition(5, "x", NaN), false);
slots.find(s=>s.id==="off").insideNamePosition = {x:0.03,y:0.8};
ctx.resetInsideNamePositions();
assert.equal(on.insideNamePosition, undefined);
assert(slots.find(s=>s.id==="off").insideNamePosition);
pos = ctx.insideNamePosition(on, [0,1], 0.2, 0.75);
close(pos.x, 0.2); close(pos.y, 0.75);
ctx.resetInsideNamePositions(true);
assert(slots.every(s=>!s.insideNamePosition));
assert.equal(renders, 2);
assert(script.includes('annotationPosition: $("clickMz").checked || $("legendMode").value === "inside"'));
assert(script.includes('renderedNameAnnotations.set(layout.annotations.length'));
assert(script.includes('if (saveInsideNamePosition(index, prop, value))'));
console.log("PASS: syntax; independent names; saved/reopened positions; panel-relative resize/reorder; stable IDs; reset selected/all; unrelated annotations ignored.");
