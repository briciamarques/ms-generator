// Optional argument: absolute path to the Catalog's current dist/exchange-core.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const X = require('../catalog-exchange.js');
(async () => {
  const corePath = process.argv[2] || path.join(__dirname, '../vendor/catalog/exchange-core.js');
  const core = await import(pathToFileURL(corePath).href);
  const packages = {};
  for (const name of ['generator-selection', 'generator-selection-deflated', 'generator-result']) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures/catalog', name + '.zip')));
    core.inspectZip(bytes);
    const files = await X.unzip(new Blob([bytes]));
    const manifest = JSON.parse(X.dec.decode(files.get('manifest.json')));
    await core.validateExchange(manifest, Object.fromEntries(files));
    packages[name] = { manifest, files };
  }
  const selection = packages['generator-selection'], result = packages['generator-result'];
  core.verifyReceipt(result.manifest, selection.manifest);
  assert.equal(result.manifest.selectionReceipt.manifestSha256, await core.sha256(selection.files.get('manifest.json')));
  const changed = structuredClone(result.manifest), files = new Map(result.files);
  const descriptor = changed.files.find(f => f.id === changed.result.artifacts.project.fileId);
  const project = JSON.parse(X.dec.decode(files.get(descriptor.path)));
  project.catalogExchange.sources[0].base64 = btoa('200 999\n');
  const altered = X.enc.encode(JSON.stringify(project));
  files.set(descriptor.path, altered);
  descriptor.size = altered.length;
  descriptor.sha256 = await core.sha256(altered);
  await assert.rejects(core.validateExchange(changed, Object.fromEntries(files)), /Editable project original TXT differs/);
  console.log('PASS: shared Catalog codec/validator accepts Generator fixtures and exact receipt; rejects tampered embedded source even with recomputed project hash.');
})().catch(error => { console.error(error); process.exitCode = 1; });