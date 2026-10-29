# MS Catalog integration — MS Generator adapter

Status on 2026-10-29: **implemented and validated locally; not published; authenticated Catalog round trip pending**. No Catalog or MS Plot repository was modified.

## Contract consumed

The Catalog owns the envelope `ms-analysis-exchange`, schema `1.0.0`, and instance `supabase:olylsohalgphhxbthyzp`. Source contract:

`C:/Users/dxv527/.codex/visualizations/2026/10/23/01a168d1-3d01-79c2-aa55-5fd025c89544/ms-catalog-vercel/docs/ANALYSIS-EXCHANGE.md`

Types: adjacent `analysis-exchange.d.ts`. No new endpoints, backend or direct account access were introduced. This is explicit local ZIP transfer.

## Use

1. In Catalog, export a selection for **MS Generator**, choosing individual TXT records in an existing study.
2. In Generator, open **Projects → MS Catalog · file packages**, choose the ZIP, review the study and individual TXT IDs, then **Open reviewed package**. Existing editor contents are replaced only after confirmation; saved projects remain intact.
3. Edit the figure normally. For a comparison result, open **Compare spectra**, choose its inputs and options, and choose **Spectrum comparison** in the package section.
4. Enter a title and use **Download new result version**. Import that ZIP in Catalog to save it there. A download is not a cloud-save confirmation.
5. **Download same version again** repeats exactly the same bytes/IDs for retries. Reopening a result restores its native project; a new export has a new version UUID, retaining the result UUID and linking `previousVersionId` to the version opened.

Package outputs: PNG, traceable CSV and native JSON. Comparison additionally exports a comparison CSV. SVG remains available through the normal Generator export but is intentionally not included in Catalog v1: the Catalog contract does not enable SVG storage yet.

## Native project format — confirmation for Catalog

- `result.editor.app` / `artifacts.project.editor`: `ms-generator`
- `artifacts.project.formatId`: `ms-generator-project`
- `artifacts.project.formatVersion`: `2`
- Native content: actual `projectFromForm` snapshot, with `spectrumSchemaVersion: 2`, `fields`, `checks`, `spectra`, `activeSpectrumId`, `selectedPeaks`, `labelEdits`, `customAnnotations` and normal project identity/time.
- `datasetBindings[].datasetId`: exact `spectra[].id` (`spectrum-*`), never a filename or array index.
- Each binding has one Catalog `inputId`, matching `spectra[].catalogInputId`. `spectra[].catalogSeriesId` is a separate result-series UUID.
- `catalogExchange` retains immutable input descriptors/snapshots, exact TXT bytes (base64), selection receipt ID and exact original manifest hash, extensions and result/version lineage.
- `catalogComparisonSelection` preserves selected comparison slots; `catalogAxisRanges` preserves visible ranges in the exported native project. Figure style, dimensions, normalizations and annotations are restored from the native settings.

**Catalog compatibility confirmed:** the Catalog now registers `ms-generator-project` version `2`. Its current, unmodified `dist/exchange-core.js` accepted all three Generator fixtures below, checked the selection receipt and rejected a project whose embedded TXT was altered even after its file descriptor hash was recomputed. This supersedes the earlier unsupported-native-format error. Actual authenticated Catalog persistence/reopen and a second-session privacy check remain pending.

Fixtures for that work (all synthetic, no user data):

- `tests/fixtures/catalog/generator-selection.zip`
- `tests/fixtures/catalog/generator-selection-deflated.zip`
- `tests/fixtures/catalog/generator-result.zip`

The result references the receipt/hash of `generator-selection.zip`. Both TXT records have the same filename and experiment/RAW source, but distinct IDs and values. They remain separate. The PNG and native JSON are real Generator outputs, not placeholder editor projects.

## Preservation and semantics

- Source TXT bytes and hashes are retained, including CRLF; inspection/sorting for plotting does not rewrite the packaged originals.
- Every imported TXT gets its own slot; no deduplication by name, RAW, experiment or even identical content.
- `unknown` normalization remains unknown. No experimental replication is inferred.
- Manual text edits keep the original input and add an explicit `manual-spectrum-edit` transformation. Original and editor values appear separately in the CSV's `data_stage` column.
- Current display normalization is recorded exactly: intensity / max(1, maximum editor intensity) × 100. Comparison uses its existing distinct calculation and records mode, tolerance, units, minimum intensity and selected datasets.
- Every CSV row contains `series_id` and JSON `input_ids`. Display-rounded comparison values are accompanied by the full numeric source/editor table.
- All datasets retained in the native project are declared inputs; figure visibility and comparison selection are explicit method parameters. Removing a slot allows a result subset. Manually adding an unbound spectrum blocks package export until that TXT is selected in the Catalog; no invented source IDs.
- Saved local/cloud projects carry the context explicitly. Existing cloud actions remain separate and require the user's normal explicit save; importing a package performs no external persistence.
- Results are `exploratory-unvalidated`; exporting a figure does not certify scientific comparability.

## Files and validation

- `catalog-exchange.js`: bounded ZIP codec and integrity checks; supports stored and deflated ZIPs. Rejects traversal, duplicates, overlapping headers, symlinks, undeclared files, unsupported version/features, RAW/credential payload keys and hash/size mismatches.
- `catalog-integration.js`: review UI, native bindings, PNG/CSV/project packaging, reopen and version handling.
- `index.html`: small native adapter and provenance-preserving project hooks.
- `comparison.js`: exposes existing comparison selection/parameters without replacing its algorithms.
- `vendor/catalog/`: unmodified snapshot of Catalog validation/processing code, including `inspectZip` and native Generator recognition, documented in `PROVENANCE.md`.

Validated with `node tests/catalog-integration.cjs`: import/export/reopen, exact receipt hash and source hashes, same-name/same-RAW preservation, immutable version chain, real PNG, source/edited CSV and comparison CSV, unknown extensions, UI review/open/download, identical retry bytes, compressed ZIP and malformed/corrupted package rejection. Native project copy-settings, comparison, browser backup and cloud preset tests also passed.

Existing unrelated test limitation: `tests/name-positions.cjs` asserts the old literal `annotationPosition: $("clickMz").checked || ...`; HEAD already uses `annotationPosition: true` from the earlier label-drag fix. Its failure was confirmed against the baseline and not hidden by altering that test.

Compatibility also passes `node tests/catalog-compatibility.cjs`, which accepts an optional absolute path to the Catalog checkout’s `dist/exchange-core.js`. It was run against that actual checkout, not only the vendored copy.

No claim of complete integration: deployment/verification of server-side result-reference guards, actual authenticated result import/reopen and a second-session privacy test remain the Catalog-side end-to-end gate. Transfer-direct and SVG-in-Catalog are future work.