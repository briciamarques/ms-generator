# Catalog validator snapshot

Copied read-only from the active MS Catalog checkout on 2026-10-29:
`C:/Users/dxv527/.codex/visualizations/2026/10/23/01a168d1-3d01-79c2-aa55-5fd025c89544/ms-catalog-vercel/dist/`.

Exact source SHA-256 at copy time:
- exchange-core.js: 3d395dffce4d6cd0f8138c150d8e11014c033f635b904ea3b140551b1767f2cd
- processing.js: 899d1e19c9ffda274312c307fc2814f7df273f21f66b9aa695c69baea1a7ea79

Both files are now byte-for-byte copies, without local native-format patches. The shared core itself recognizes `ms-generator-project` version `2` and validates the native source bindings and embedded TXT hashes. This replaces the earlier locally extended snapshot.

Generator invokes the shared `inspectZip` before extraction and `validateExchange` afterward. Its bounded ZIP reader/writer handles the bytes; the core's codec functions requiring fflate are not used. No contract changes, HTTP routes or database writes were introduced.

`node tests/catalog-compatibility.cjs [absolute-path-to-catalog-exchange-core.js]` verifies compatibility and rejects adulterated embedded TXT. It was run against the active Catalog checkout as well as the local browser flow with this snapshot. Actual authenticated Catalog persistence is a separate end-to-end test.
