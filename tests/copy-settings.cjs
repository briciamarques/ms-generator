const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).join("\n");
new vm.Script(script);
const start = script.indexOf("    function projectWithCopiedSettings(");
const end = script.indexOf("\n    function ", start + 1);
assert(start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(script.slice(start, end), context);
const current = {
  id: "target", name: "4ABA", activeSpectrumId: "spectrum-target",
  fields: { chartTitle: "4ABA", fontSize: "9", fontUnit: "pt", lineUnit: "pt", sizeUnit: "mm", yScale: "110", mzLabelDistance: "-2" },
  checks: { normalize: false, lockX: true },
  spectra: [
    { id: "spectrum-target", name: "290 nm", data: "123 100", visible: true, color: "#111111", minMz: "", maxMz: "", yScale: "" },
    { id: "spectrum-second", name: "310 nm", data: "125 100", visible: false, color: "#222222" }
  ],
  selectedPeaks: [{ key: "spectrum-target|123.000000" }],
  labelEdits: { "spectrum-target|123.000000": { ay: -10 } },
  customAnnotations: [{ text: "4ABA annotation" }]
};
const source = {
  id: "source", name: "3ABA",
  fields: { chartTitle: "3ABA", fontSize: "8", fontUnit: "pt", lineUnit: "pt", sizeUnit: "mm", yScale: "150", minMz: "50", maxMz: "180", yTickStep: "50", mzLabelDistance: "-5", exportWidth: "1200" },
  checks: { normalize: true, lockX: false },
  spectra: [{ id: "spectrum-source", name: "source name", data: "94 100", visible: false, color: "#ff0000", minMz: "60", maxMz: "160", yScale: "150", xTickStep: "20" }],
  selectedPeaks: [{ key: "spectrum-source|94.000000" }],
  labelEdits: { source: { ay: -99 } },
  customAnnotations: [{ text: "3ABA annotation" }]
};
const keys = ["fontSize", "yScale", "minMz", "maxMz", "yTickStep", "yTickMax", "mzLabelDistance", "exportWidth", "normalize", "lockX"];
const before = JSON.stringify({ current, source });
const copied = context.projectWithCopiedSettings(current, source, keys);
assert.equal(copied.id, current.id);
assert.equal(copied.name, "4ABA");
assert.equal(copied.fields.chartTitle, "4ABA");
assert.equal(copied.fields.mzLabelDistance, "-5");
assert.equal(copied.fields.yScale, "150");
assert.equal(copied.fields.minMz, "50");
assert.equal(copied.fields.exportWidth, "1200");
assert.equal(copied.checks.normalize, true);
assert.equal(copied.checks.lockX, false);
assert.equal(copied.spectra[0].data, "123 100");
assert.equal(copied.spectra[0].name, "290 nm");
assert.equal(copied.spectra[0].id, "spectrum-target");
assert.equal(copied.spectra[0].visible, true);
assert.equal(copied.spectra[0].color, "#ff0000");
assert.equal(copied.spectra[0].maxMz, "160");
assert.equal(copied.spectra[1].color, "#222222");
assert.equal(copied.spectra.length, 2);
assert.equal(JSON.stringify(copied.selectedPeaks), JSON.stringify(current.selectedPeaks));
assert.equal(JSON.stringify(copied.labelEdits), JSON.stringify(current.labelEdits));
assert.equal(JSON.stringify(copied.customAnnotations), JSON.stringify(current.customAnnotations));
assert.equal(JSON.stringify({ current, source }), before);
const legacy = context.projectWithCopiedSettings(current, {
 fields: { peakColor1: "#00ff00", minMz1: "40", maxMz1: "200", yScale1: "180", fontSize: "24", data1: "WRONG" }
}, keys);
assert.equal(legacy.spectra[0].color, "#00ff00");
assert.equal(legacy.spectra[0].minMz, "40");
assert.equal(legacy.spectra[0].data, "123 100");
assert.equal(legacy.fields.mzLabelDistance, "3");
assert.equal(legacy.fields.yTickMax, "");
assert.equal(legacy.fields.fontUnit, undefined); // Allow existing legacy conversion.
assert.equal(current.fields.fontUnit, "pt");
copied.fields.minMz = "70";
assert.equal(source.fields.minMz, "50");
const emptyTarget = context.projectWithCopiedSettings({ ...current, id: "", name: "" }, source, keys);
assert.equal(emptyTarget.id, "");
assert.equal(emptyTarget.name, "");
console.log("PASS: syntax; settings, ranges, export and distance copied; current identity/data/labels retained; source unchanged; positional colors; missing slots; legacy settings; editable copies.");
