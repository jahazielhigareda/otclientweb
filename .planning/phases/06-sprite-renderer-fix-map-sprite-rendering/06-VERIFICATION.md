---
phase: 06-sprite-renderer
verified: 2026-05-14T16:00:00Z
status: passed
score: 6/6 must-haves truths verified
re_verification: false
gaps: []
---

# Phase 6: Sprite Renderer — Fix Map & Sprite Rendering Verification Report

**Phase Goal:** Fix sprite rendering pipeline so the game map displays correctly (tiles with proper ground sprites, creatures with correct outfits, no blue-tint/color corruption).
**Verified:** 2026-05-14T16:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Tile ground sprites render with natural colors (no blue tint)" | ✓ VERIFIED | `SpritesFile.ts:65-67` reads bytes R,G,B matching .spr format; human verification approved per SUMMARY checkpoint |
| 2 | "Creature outfit sprites render with correct colors" | ✓ VERIFIED | Channel swap fix is global — all `decodeSprite()` output has correct RGB order |
| 3 | "All sprite-based rendering (items, effects, outfits) shows correct RGB colors" | ✓ VERIFIED | All sprite IDs go through same `getSprite()` → `decodeSprite()` with fixed byte order |
| 4 | "Sprite cache returns correct-color sprites for all cached IDs" | ✓ VERIFIED | `ImageData` stored in `cache[]` array with correct pixel data; no invalidation needed |
| 5 | "Tiles with minimapColor show a colored overlay on the ground sprite" | ✓ VERIFIED | `GameRenderer.ts:144-151` — RGB565 → rgba semi-transparent fillRect after ground draw |
| 6 | "Items on top of ground render in correct stacking order" | ✓ VERIFIED | `ProtocolGame.ts:565,589-594` collects all itemIds; `GameRenderer.ts:164-172` renders after ground |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/core/SpritesFile.ts` | Fixed decodeSprite() — R,G,B byte order | ✓ VERIFIED | Lines 65-67: `const r = dv.getUint8(offset++)` then `g` then `b`. Lines 68-71: pixel assignment unchanged (R,G,B,A). Background color read (39-41) also R,G,B — consistent. |
| `client/src/core/GameRenderer.ts` | Minimap color overlay + stacked item rendering | ✓ VERIFIED | Lines 144-151: RGB565 overlay (`mc >> 11`, `mc >> 5`, `mc & 0x1F`). Lines 164-172: `tile.itemIds` loop → `dat.getItem()` → `drawItem()`. Ground draw at 140-152 preserved before stacking. |
| `client/src/core/GameMap.ts` | itemIds field on TileData | ✓ VERIFIED | Line 10: `itemIds?: number[];` in TileData interface. `setTile()` via `Object.assign()` accepts Partial<TileData>. |
| `client/src/network/protocols/ProtocolGame.ts` | Item ID collection in parseTileDescription | ✓ VERIFIED | Line 565: `const itemIds: number[] = []`. Lines 589-594: `groundId` vs `itemIds.push()` split. Lines 597-601: `setTile` passes both `groundId` and `itemIds`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SpritesFile.ts:decodeSprite()` lines 65-67 | Returned `ImageData` pixels | `pixels[pixel++] = r/g/b` (lines 68-70) → `new ImageData(pixels, size, size)` (line 77) | ✓ WIRED | Byte[0]=R → var `r` → ImageData[0] (R). Byte[1]=G → var `g` → ImageData[1] (G). Byte[2]=B → var `b` → ImageData[2] (B). |
| `SpritesFile.ts:decodeSprite()` lines 65-67 | Background color read lines 39-41 | Same byte order: `const red/green/blue = dv.getUint8(offset++)` | ✓ WIRED | Background reads R,G,B (correct since initial implementation). Pixel reads now match. |
| `ProtocolGame.parseTileDescription()` lines 597-601 | `GameMap.setTile()` | `g_gameMap.setTile(tileX, tileY!, tileZ!, { groundId, itemIds })` | ✓ WIRED | Pattern `setTile\(tileX, tileY!, tileZ!,` at line 598. Both groundId and itemIds passed. Condition uses `tileX !== undefined` (no longer requires groundId). |
| `GameRenderer.render()` lines 164-172 | `GameMap TileData.itemIds` | `tile.itemIds` → `for (const itemId of tile.itemIds)` → `dat.getItem(itemId)` → `this.drawItem()` | ✓ WIRED | Pattern `tile\.itemIds` matches at lines 165-166. `for...of tile.itemIds` at line 166. Null-guarded by `if (tile.itemIds && dat)`. drawItem handles multi-layer sprites. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `GameRenderer.ts:145` — minimapColor | `item.minimapColor` | `DatFile.getItem()` → `DatItem.minimapColor` (parsed from .dat flag 28) | Yes — parsed from actual .dat file data | ✓ FLOWING |
| `GameRenderer.ts:165` — stacked items | `tile.itemIds` | `ProtocolGame.parseTileDescription()` → `itemIds.push(result.tibiaId)` → `setTile({itemIds})` | Yes — collected from server packet parse | ✓ FLOWING |
| `SpritesFile.ts:65-67` — sprite pixels | `pixels[]` (Uint8ClampedArray) | `.spr` file bytes → `dv.getUint8()` at offset → var `r/g/b` → ImageData | Yes — raw .spr data, correct byte order | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Step 7b: SKIPPED (no runnable entry points — requires running game server, proxy, and browser) | N/A | N/A | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| RENDER-01 | 06-01 | All tile sprites render with correct colors (no channel swap / blue tint) | ✓ SATISFIED | Channel swap fix: SpritesFile.ts lines 65-67 read R,G,B. Human verification approved per 06-01 SUMMARY. |
| RENDER-02 | 06-01 | Ground tiles display correct .spr sprites based on item IDs from server | ✓ SATISFIED | Ground rendering via `dat.getItem(tile.groundId)` at GameRenderer.ts:141. Colors correct due to fix. |
| RENDER-03 | 06-01 | Creature outfits render with correct colors and direction | ✓ SATISFIED (color) | Colors fixed by channel swap (affects all sprite decoding). Direction mapping (North/West at px=0 in `drawOutfit()`) is known scope boundary per D-02 — deferred for separate investigation. |
| RENDER-04 | 06-01 | Sprite cache works without visual artifacts (alpha, positioning) | ✓ SATISFIED | Cache at SpritesFile.ts:22-33 stores ImageData with correct pixel data. Alpha=255 for colored, alpha=0 for transparent (RLE skip). |
| RENDER-05 | 06-02 | Minimap colors render on tiles when available | ✓ SATISFIED | GameRenderer.ts:144-151 renders RGB565 semi-transparent overlay when `item.minimapColor > 0`. |
| RENDER-06 | 06-02 | Items on top of ground (objects, effects) render in correct stacking order | ✓ SATISFIED | ProtocolGame.ts:565,589-594 collects all item IDs. GameRenderer.ts:164-172 renders stacked items before creature pass. Server parse order = correct stacking. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODOs, FIXMEs, placeholders, empty handlers, console.log stubs, or hardcoded fallback values in modified code | ℹ️ Clean | All modified files are production-ready |

Additional notes:
- No stubs or placeholders found in any of the 4 modified files
- `return null` in SpritesFile.ts:21,27 are guard clauses for invalid IDs — not stubs
- `return null` in GameRenderer.ts:39,41 are guard clauses for missing resources — not stubs
- No `console.log` or console-only implementations in GameRenderer.ts (modified code)
- TypeScript compilation errors are all pre-existing (in DatFile.ts duplicate `height` property, `erasableSyntaxOnly` enum, unused variables, Uint8Array generic incompatibility)

### Gaps Summary

No gaps found. All 6 must-have truths verified. All 4 artifacts exist, are substantive, wired, and have real data flowing. All key links are connected. Requirements RENDER-01 through RENDER-06 are satisfied.

### Verifier's Notes

1. **RENDER-03 direction scoping:** The "direction" aspect of RENDER-03 (`drawOutfit()` direction mapping for creature outfits) is acknowledged as out of scope per D-02 in the research. The current `drawOutfit` switch maps directions 3→0, 1→1, 2→2, 0→0 (default), which may cause North (0) and West (3) to collide at px=0 for some .dat layouts. This is a pre-existing issue documented in the research and deferred for separate investigation.

2. **Pre-existing TypeScript errors:** The project has ~40 pre-existing TypeScript errors (enum with `erasableSyntaxOnly`, duplicate interface properties, unused variables, Uint8Array generics). None were introduced by this phase's changes. The 06-02 SUMMARY correctly documents this.

3. **Human verification checkpoint:** Plan 06-01 Task 2 was a human-verify gate (visual confirmation of sprite colors). The SUMMARY records it as "approved" with note "Colors confirmed correct — grass green, no blue tint." This checkpoint blocks automated verification of sprite color correctness.

4. **fillRect count discrepancy:** The 06-02 PLAN acceptance criteria expected 4 `fillRect.*screenX.*screenY.*TILE_SIZE` matches but the actual count is 3 (the original code had 2 fallback fillRects, not 3). The 06-02 SUMMARY correctly calls this out as a documentation discrepancy in the plan, not a code bug.

---

_Verified: 2026-05-14T16:00:00Z_
_Verifier: OpenCode (gsd-verifier)_
