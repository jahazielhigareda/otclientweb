# Phase 6: Sprite Renderer — Fix Map & Sprite Rendering - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix sprite rendering pipeline so the game map displays correctly (tiles with proper ground sprites, creatures with correct outfits, no blue-tint/color corruption). This is a debugging/fix phase for the existing renderer — no new rendering capabilities.

</domain>

<decisions>
## Implementation Decisions

### Root Cause
- **D-01:** The root cause is a red-blue channel swap in `SpritesFile.ts:decodeSprite()`. The background color is read as R,G,B (correct) but pixel data is read as B,G,R (wrong). The .spr file stores pixels in RGB order, consistent with the background color format. This causes the red channel to receive blue data and vice versa.
- **D-02:** No other rendering pipeline components need investigation — the channel swap explains the observed "blue tones" symptom fully.

### Fix Approach
- **D-03:** Fix `decodeSprite()` pixel reading to match the background color byte order (R, G, B → stores as R, G, B). This is a one-line change of variable bindings in the colored pixel loop at `SpritesFile.ts:64-66`.

### Verification
- **D-04:** Verify visually after fix — load the game, observe tile and creature sprite colors for correctness. No automated test needed for this phase.
- **D-05:** If the fix doesn't fully resolve the issue, add console logging of the first sprite's raw pixel values to compare against expected colors.

### OpenCode's Discretion
- Diagnostic logging verbosity level
- Any additional rendering pipeline investigation if the channel swap fix is insufficient

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sprite pipeline
- `client/src/core/SpritesFile.ts` — SPR decode logic (target of the fix at `decodeSprite()`)
- `client/src/core/DatFile.ts` — Dat item parsing, sprite ID storage
- `client/src/core/GameRenderer.ts` — Canvas rendering, sprite cache, item/outfit drawing
- `client/src/core/GameMap.ts` — Tile storage and creature data

### Protocol → Map data
- `client/src/network/protocols/ProtocolGame.ts` — Map parsing (`parseFullMap`, `parseTileDescription`, `parseThing`)
- `client/src/network/types.ts` — TilePosition type

### Resources
- `client/src/core/ResourceLoader.ts` — .dat/.spr file loading pipeline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SpritesFile.ts` — Existing SPR decoder with sprite cache. All sprite pixel data flows through `decodeSprite()`.
- `GameRenderer.ts` — Existing renderer with sprite canvas cache (`getSpriteCanvas`). Change in decodeSprite will affect all rendered sprites (tiles + creatures).
- `DatFile.ts` — Item/outfit lookup from .dat. Not affected by the sprite color fix.

### Established Patterns
- Singleton pattern for game systems (GameRenderer, GameMap, ResourceLoader)
- Canvas-based 2D rendering via `drawImage` from cached sprite canvases
- Sprite cache keyed by sprite ID (`Map<number, HTMLCanvasElement>`)

### Integration Points
- The fix is self-contained in `SpritesFile.ts:decodeSprite()` — no other files need changes
- After fix, rebuild with `npx vite` and reload the game to verify

</code_context>

<specifics>
## Specific Ideas

- The background color bytes in `decodeSprite()` are read as R, G, B (lines 39-41). The pixel data bytes should match this order — currently they read B, G, R (lines 64-66). This inconsistency is the bug.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-sprite-renderer*
*Context gathered: 2026-05-14*
