# Deferred Items — Phase 06-01

Out-of-scope pre-existing issues discovered during execution (per SCOPE BOUNDARY rule):

## Pre-existing TypeScript Errors (unrelated files)

The following errors exist in files unrelated to this plan's fix. These are pre-existing and not caused by the channel swap fix.

### DatFile.ts
- TS2300: Duplicate identifier 'height' (lines 11, 21)
- TS1294: ErasableSyntaxOnly — enum syntax not allowed (line 31)
- TS6133: Unused variables (lines 76-78, 133, 139)
- TS1117: Duplicate property name in object literal (line 145)

### GameRenderer.ts
- TS6133: Unused variables (lines 67, 171)

### ResourceLoader.ts
- TS2345: Uint8Array<ArrayBufferLike> not assignable to BlobPart (lines 53, 82)

### SpritesFile.ts (pre-existing)
- TS6133: Unused 'buffer' (line 2), unused 'red'/'green'/'blue' (lines 39-41), unused 'signature' (line 84)

### ProtocolLogin.ts
- TS6133: Unused variables (lines 9-10, 100)
- TS2345: ArrayBufferLike not assignable to ArrayBuffer (line 145)
- TS7034/TS7005: Implicit 'any' for 'chars' (lines 167, 185)

### ProtocolGame.ts
- TS6133: 7 unused variables (lines 228, 247, 251, 265, 296, 387, 458, 462, 525)

### ProtocolCodes.ts
- TS1294: ErasableSyntaxOnly — 6 enum syntax errors

### Connection.ts
- TS2345: Uint8Array<ArrayBufferLike> not assignable to BlobPart (line 33)

### NetworkManager.ts
- TS6133: Unused variables (lines 23, 45)

### App.tsx
- TS6133: Unused 'React' import (line 1)

**Note:** None of these issues affect the correctness of the channel swap fix. They should be addressed in a dedicated cleanup plan.
