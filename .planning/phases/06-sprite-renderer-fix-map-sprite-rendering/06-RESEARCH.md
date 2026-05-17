# Phase 6: Sprite Renderer — Fix Map & Sprite Rendering — Research

**Researched:** 2026-05-14
**Domain:** Tibia 8.60 .spr sprite decoding, Canvas 2D rendering pipeline
**Confidence:** HIGH

## Summary

The phase fixes a red-blue channel swap in `SpritesFile.ts:decodeSprite()` that causes all sprite pixel data to render with swapped R and B channels, producing a "blue tint" on all game sprites (ground tiles, creatures, effects). The .spr file format stores pixels in **RGB byte order** (R first, G second, B third), confirmed against the canonical OTClient C++ reference implementation (`spritemanager.cpp`), the Szune/Tibia71SprExtractor spec, and multiple community reverse-engineering documents. The current JavaScript code reads pixel bytes in the wrong order (`b, g, r`) instead of `r, g, b`, causing the red channel to receive blue data and vice versa.

**Primary recommendation:** Change the variable bindings on lines 64-66 of `SpritesFile.ts` from `const b, g, r` to `const r, g, b` to match the .spr file format and the background color reading pattern (lines 39-41) which is already correct.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RENDER-01 | All tile sprites render with correct colors (no channel swap / blue tint) | **HIGH:** Channel swap fix directly addresses this. `.spr` format confirmed RGB. |
| RENDER-02 | Ground tiles display correct .spr sprites based on item IDs from server | **HIGH:** Item lookup pipeline (DatFile → spriteId → SpritesFile) is correct. Fix propagates correct colors. |
| RENDER-03 | Creature outfits render with correct colors and direction | **MEDIUM:** Colors will be fixed by channel swap. Direction mapping may have issues (see Open Questions). |
| RENDER-04 | Sprite cache works without visual artifacts (alpha, positioning) | **HIGH:** Cache stores `ImageData` objects. Fix produces correct pixel data for all cached sprites. |
| RENDER-05 | Minimap colors render on tiles when available | **LOW:** `minimapColor` is parsed from `.dat` and stored in `TileData` but **not used** in `GameRenderer.render()`. Requires renderer addition, not covered by channel swap fix. |
| RENDER-06 | Items on top of ground (objects, effects) render in correct stacking order | **LOW:** Current `parseTileDescription` only stores `groundId`. Items beyond ground are parsed but their IDs are overwritten. Requires protocol parsing + renderer changes. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The root cause is a red-blue channel swap in `SpritesFile.ts:decodeSprite()`. The background color is read as R,G,B (correct) but pixel data is read as B,G,R (wrong). The .spr file stores pixels in RGB order, consistent with the background color format. This causes the red channel to receive blue data and vice versa.
- **D-02:** No other rendering pipeline components need investigation — the channel swap explains the observed "blue tones" symptom fully.
- **D-03:** Fix `decodeSprite()` pixel reading to match the background color byte order (R, G, B → stores as R, G, B). This is a one-line change of variable bindings in the colored pixel loop at `SpritesFile.ts:64-66`.
- **D-04:** Verify visually after fix — load the game, observe tile and creature sprite colors for correctness. No automated test needed for this phase.
- **D-05:** If the fix doesn't fully resolve the issue, add console logging of the first sprite's raw pixel values to compare against expected colors.

### OpenCode's Discretion
- Diagnostic logging verbosity level
- Any additional rendering pipeline investigation if the channel swap fix is insufficient

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | N/A (browser built-in) | Sprite rendering via `putImageData` → cached canvas → `drawImage` | Only viable browser 2D rendering API |
| TypeScript | (project config) | Type-safe implementation of SPR decoder | Project language |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `DataView` | N/A (ES2015+) | Binary file reading for .spr parsing | All binary protocol/file parsing |
| `Uint8ClampedArray` | N/A (ES2015+) | Pixel buffer for `ImageData` creation | Required by `ImageData` constructor |
| `ImageData` | N/A (DOM API) | Raw pixel container from sprite decode | Required for `putImageData` into canvas |

### Alternative SPR Decoders (Reference Implementations)

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Current `SpritesFile.ts` | OTClient C++ `spritemanager.cpp` reference | C++ reference is the canonical implementation; JS is a port. Both use same algorithm. |
| Current `SpritesFile.ts` | `ot-spr` npm library (V0RT4C/ot-spr) | External dependency for existing decoder. Not needed for one-line fix. |
| Current `SpritesFile.ts` | TibiaJS sprites-extractor (Node.js) | Node-only, not browser-compatible. |

## Architecture Patterns

### Recommended Project Structure (unchanged)
```
client/src/core/
├── SpritesFile.ts       # SPR decoder — target of the fix (decodeSprite)
├── DatFile.ts           # .dat parser — unaffected
├── GameRenderer.ts      # Canvas renderer — receives fixed sprite pixel data
├── ResourceLoader.ts    # File loading pipeline — loads .spr/.dat
└── GameMap.ts           # Tile/creature storage — unaffected
```

### Pattern 1: Sprite Decode Pipeline
**What:** `.spr` file → `SpritesFile.decodeSprite()` → `ImageData` → `putImageData` → cached `<canvas>` → `drawImage` → main canvas
**When to use:** All sprite rendering (tiles, creatures, effects, missiles)
**Example:**
```typescript
// SpritesFile.ts — pixel data flow
// .spr format: [R][G][B] per colored pixel (confirmed by OTClient reference)
// OTClient C++ (edubart/otclient/src/client/spritemanager.cpp):
//   pixels[writePos + 0] = m_spritesFile->getU8();  // R
//   pixels[writePos + 1] = m_spritesFile->getU8();  // G
//   pixels[writePos + 2] = m_spritesFile->getU8();  // B
//   pixels[writePos + 3] = 0xFF;                      // A

// Current bug (SpritesFile.ts:64-67):
const b = dv.getUint8(offset++);  // reads byte[0]=R → named 'b' → stored as B channel
const g = dv.getUint8(offset++);  // reads byte[1]=G → named 'g' → stored as G channel ✓
const r = dv.getUint8(offset++);  // reads byte[2]=B → named 'r' → stored as R channel
// Result: R↔B swap

// Fix:
const r = dv.getUint8(offset++);  // reads byte[0]=R → named 'r' → stored as R channel ✓
const g = dv.getUint8(offset++);  // reads byte[1]=G → named 'g' → stored as G channel ✓
const b = dv.getUint8(offset++);  // reads byte[2]=B → named 'b' → stored as B channel ✓
```

### Anti-Patterns to Avoid
- **Assuming byte order from incomplete memory:** The .spr format stores RGB. Don't assume BGR just because some image formats or BMP headers use BGR. Every authoritative source confirms RGB.
- **Modifying more than needed:** The fix is self-contained in one 3-line block. Don't refactor `decodeSprite()` or the caching logic during this fix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sprite decompression algorithm | Custom pixel unpacking | Current RLE decode logic (matches OTClient) | Already implemented and correct — only byte order is wrong |
| Sprite caching | New cache system | Existing `Map<number, ImageData>` + `Map<number, HTMLCanvasElement>` | Both caches work correctly, just need fresh pixel data |

**Key insight:** This is a one-line bug fix, not a rewrite. The decode algorithm matches OTClient C++ exactly — the only error is the variable binding order in the colored pixel read loop.

## Common Pitfalls

### Pitfall 1: Over-Rotating the Fix
**What goes wrong:** Applying the "reverse" fix in the wrong direction (e.g., swapping the ImageData storage order instead of the read order).
**Why it happens:** Confusion between file byte order and ImageData format. ImageData expects [R, G, B, A] order. The current code stores in this order correctly — the bug is that the VALUES read from the file are assigned to the wrong channels.
**How to avoid:** Change ONLY the variable names in the `const` declarations on lines 64-66. Do NOT change the pixel assignment order on lines 68-71. The assignments `pixels[pixel++] = r/g/b` are already correct — just `r` currently holds the Blue value and `b` holds Red.
**Warning signs:** If after fix, sprites appear more blue or green, the fix was applied in the wrong direction.

### Pitfall 2: Cache Not Invalidating
**What goes wrong:** Old cached sprite images still show the channel swap after fix.
**Why it happens:** `SpritesFile.cache` stores decoded `ImageData` objects. The fix produces correct data only for NEWLY decoded sprites.
**How to avoid:** Page reload clears all in-memory caches. No manual invalidation needed since this is a code change, not a runtime toggle.
**Warning signs:** N/A — only relevant if testing hot-reload without page refresh.

### Pitfall 3: Canvas Color Space Assumptions
**What goes wrong:** Assuming `putImageData` → `drawImage` converts color spaces, causing unexpected shifts.
**Why it happens:** Modern browsers support `display-p3` canvas color space via `canvas.getContext('2d', { colorSpace: 'display-p3' })`. 
**How to avoid:** The current `GameRenderer` creates context without explicit `colorSpace`, defaulting to `'srgb'`. `ImageData` also defaults to `'srgb'`. Both are same color space → zero conversion. Verified against MDN CanvasColorManagement spec.
**Warning signs:** Not applicable — default behavior is correct.

### Pitfall 4: Premultiplied Alpha Rounding
**What goes wrong:** Slight color shifts on translucent sprite edges due to premultiplied alpha rounding.
**Why it happens:** Canvas 2D internally uses premultiplied alpha. When `putImageData` is called with non-premultiplied data, the browser premultiplies internally. For alpha=255 pixels, this is a no-op (no color change). For alpha=0 pixels (transparent), RGBA=(0,0,0,0) is already premultiplied.
**How to avoid:** This isn't an issue for Tibia sprites since colored pixels always have alpha=255 and transparent pixels have alpha=0. No action needed.
**Warning signs:** Only relevant if future features add partial-transparency sprites.

## Code Examples

### Fix for `SpritesFile.ts:decodeSprite()` (lines 64-66)

**Before (BUG):**
```typescript
// Lines 64-67 of SpritesFile.ts — reads byte order as B, G, R
const b = dv.getUint8(offset++);
const g = dv.getUint8(offset++);
const r = dv.getUint8(offset++);
```

**After (FIX):**
```typescript
// Fixed: reads byte order as R, G, B — matching .spr format
const r = dv.getUint8(offset++);
const g = dv.getUint8(offset++);
const b = dv.getUint8(offset++);
```

**DO NOT change lines 68-71** (they correctly store as R, G, B, A):
```typescript
// These lines are already correct — no changes needed
pixels[pixel++] = r;
pixels[pixel++] = g;
pixels[pixel++] = b;
pixels[pixel++] = 255;
```

### Full `decodeSprite()` after fix (annotated with .spr layout)
```typescript
private decodeSprite(address: number): ImageData {
    const dv = this.dataView;
    let offset = address;

    // .spr sprite header:
    const red = dv.getUint8(offset++);   // Background color R (transparency key)
    const green = dv.getUint8(offset++); // Background color G
    const blue = dv.getUint8(offset++);  // Background color B — CORRECT, don't touch

    let remaining = dv.getUint16(offset, true); // Pixel data size in bytes
    offset += 2;

    const size = 32;
    const pixels = new Uint8ClampedArray(size * size * 4);

    let pixel = 0;

    while (remaining > 0) {
        const transparent = dv.getUint16(offset, true); // Transparent pixels to skip
        offset += 2;
        remaining -= 2;

        pixel += transparent * 4;

        if (remaining <= 0) break;

        const colored = dv.getUint16(offset, true); // Colored pixels to write
        offset += 2;
        remaining -= 2;

        for (let i = 0; i < colored; i++) {
            // FIX: .spr stores R, G, B — read in same order as background color
            const r = dv.getUint8(offset++);
            const g = dv.getUint8(offset++);
            const b = dv.getUint8(offset++);
            // ImageData format: [R, G, B, A] — this order is correct
            pixels[pixel++] = r;
            pixels[pixel++] = g;
            pixels[pixel++] = b;
            pixels[pixel++] = 255;
        }

        remaining -= colored * 3;
    }

    return new ImageData(pixels, size, size);
}
```

### Diagnostic Logging (for D-05 contingency)
```typescript
// Add after decodeSprite to verify first 10 non-transparent pixels
// Place after the colored pixel loop
if (id <= 5) { // log for first few sprite IDs
    for (let i = 0; i < Math.min(pixel, 40); i += 4) {
        if (pixels[i+3] === 255) { // only non-transparent
            console.log(`Sprite ${address} pixel[${i/4}]: R=${pixels[i]} G=${pixels[i+1]} B=${pixels[i+2]}`);
        }
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A (bug fix) | Correct RGB order matching OTClient | This phase | All sprites render with proper colors |

## Rendering Pipeline Audit

Verified components in the sprite rendering flow:

1. **ResourceLoader.load()** → Downloads .spr/.dat, creates `SpritesFile` and `DatFile` ✓
2. **SpritesFile.loadFromBuffer()** → Parses .spr header: signature, sprite count, addresses ✓
3. **SpritesFile.decodeSprite()** → RLE decompression + pixel data → **BUG LOCATION** ✓
4. **SpritesFile.getSprite()** → Cache lookup, calls decodeSprite if needed ✓
5. **GameRenderer.getSpriteCanvas()** → `putImageData` → cached `<canvas>` ✓
6. **GameRenderer.render()** → `drawImage` from sprite canvases → main canvas ✓
7. **Canvas 2D pipeline** → No color space conversion (both default to sRGB) ✓
8. **Premultiplied alpha** → No color distortion (all colored pixels have alpha=255) ✓

**Components NOT affected by the fix:**
- `DatFile.ts` — item/outfit/sprite ID lookup, byte parsing — correct
- `GameMap.ts` — tile/creature storage — correct
- `ResourceLoader.ts` — file fetching/parsing — correct
- `ProtocolGame.ts` — network parsing — correct

**Components needing separate work (not covered by fix):**
- `GameRenderer.render()` — no `minimapColor` rendering (RENDER-05)
- `ProtocolGame.parseTileDescription()` — only stores `groundId`, other items overwritten (RENDER-06)
- `GameRenderer.drawOutfit()` — direction mapping may need verification (RENDER-03)

## Verification Strategy

**Visual verification (D-04):**
1. Apply fix to lines 64-66
2. Rebuild: `npx vite`
3. Load game, observe:
   - Ground tiles (grass, stone, water) should show natural colors (green/brown/blue)
   - Creature outfits should show correct skin/armor colors
   - UI elements drawn from sprites should have correct colors

**Pixel-level verification (D-05 contingency):**
1. Add diagnostic logging to `decodeSprite()` (see Code Examples section)
2. Compare logged RGB values against known .spr sprite colors
3. Background color (lines 39-41) serves as reference for correct byte order

## Edge Cases

| Edge Case | Current Handling | Impact of Fix |
|-----------|-----------------|---------------|
| `getSprite(0)` | Returns null (id < 1 check) | No change |
| `getSprite(id)` with address=0 | Returns null | No change |
| `getSprite(id)` with id > count | Returns null | No change |
| Sprite with all transparent pixels | RLE skips all pixels, ImageData is all zeros (transparent black) | Correct behavior unchanged |
| Sprite with partial RLE data (< 1024 pixels) | Remaining pixels are 0 from Uint8ClampedArray initialization | Correct (transparent black) |
| Multi-layer items (e.g., doors with windows) | `drawItem` iterates layers, each layer uses `getSpriteCanvas` | All layers now correct |
| Animated sprites | `spriteIndex` uses `phase` parameter; animation timed separately | No change needed |
| Creatures with addons | `drawOutfit` uses `py = addons > 0 ? 1 : 0` | Outfit sprites now correct colors |

## Open Questions

1. **Creature direction mapping (RENDER-03)**
   - What we know: `drawOutfit` maps direction values (0-3) to patternX indices using a switch statement. Tibia protocol: 0=North, 1=East, 2=South, 3=West. PatternX order in .dat: typically South, West, North, East.
   - What's unclear: The current mapping (3→0, 1→1, 2→2, 0→default 0) may not match the .dat patternX layout for all outfits. Direction 0 (North) and 3 (West) both map to px=0.
   - Recommendation: Not part of this phase per D-02. Flag for separate investigation if creatures face wrong directions post-fix.

2. **Minimap color rendering (RENDER-05)**
   - What we know: `DatItem.minimapColor` is parsed from .dat flag 28. `TileData.minimapColor` exists in type but is never set by `parseTileDescription`. GameRenderer doesn't use it.
   - What's unclear: Is minimap color rendered as a colored overlay on tiles? Is this a separate feature entirely?
   - Recommendation: Deferred — the channel swap fix does not address this RENDER requirement.

3. **Multiple items per tile (RENDER-06)**
   - What we know: `parseTileDescription` overwrites `groundId` with each successive item ID. The last non-creature item parsed becomes the ground.
   - What's unclear: Tibia 8.60 protocol sends things in stacking order (ground first, then items on top). The current code only keeps one item.
   - Recommendation: Requires protocol parsing changes to store item stack per tile, plus renderer changes to draw in order. Not covered by this fix.

## Sources

### Primary (HIGH confidence)
- **OTClient C++ `spritemanager.cpp`** (edubart/otclient) — Canonical reference for .spr decoding. Colored pixel bytes read as: `pixels[0]=getU8()` (R), `pixels[1]=getU8()` (G), `pixels[2]=getU8()` (B). Background color bytes skipped in same order. 
  - Source: https://github.com/edubart/otclient/blob/master/src/client/spritemanager.cpp
- **Szune/Tibia71SprExtractor** — .spr spec: `Red = Read U8, Green = Read U8, Blue = Read U8`
  - Source: https://github.com/Szune/Tibia71SprExtractor
- **Jo3bingham's .dat/.spr structure thread (OTLand)** — "The next 3 bytes are the RGB value of the colored pixels"
  - Source: https://otland.net/threads/tibia-dat-reader-dat-spr-structure-and-spr-reading-code-link.25117/
- **`V0RT4C/ot-spr`** — JavaScript library that parses .spr to RGBA arrays (R first)
  - Source: https://github.com/V0RT4C/ot-spr

### Secondary (MEDIUM confidence)
- **TibiaAPI SpriteReader.cs** — reads pixel bytes as R, G, B via `reader.ReadByte()` calls
  - Source: referenced in OTLand thread, Google Code project
- **MDN Canvas API specification** — `putImageData` with sRGB ImageData → sRGB canvas context = no color conversion
  - Source: https://html.spec.whatwg.org/dev/canvas.html

### Tertiary (LOW confidence)
- None — all critical findings verified against multiple independent sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Canvas 2D API is the browser standard, confirmed by MDN
- Architecture: HIGH — Pipeline matches OTClient C++ exactly; only byte order differs
- Pitfalls: HIGH — All identified from known .spr format documentation and Canvas API behavior
- Coverage gap: MEDIUM — RENDER-05 and RENDER-06 are listed as requirements but not addressed by the CONTEXT.md decisions; the channel swap fix alone does not fulfill them

## Validation Architecture

### Test Framework
The project currently has no test infrastructure configured (no test files found, no `package.json` test scripts detected). This is consistent with D-04 decision ("No automated test needed for this phase").

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RENDER-01 | Correct sprite colors | Visual/inspection only | N/A (manual verification) | N/A |
| RENDER-02 | Ground tiles display correct sprites | Visual/inspection only | N/A | N/A |
| RENDER-03 | Creature outfits with correct colors | Visual/inspection only | N/A | N/A |
| RENDER-04 | Sprite cache without artifacts | Visual/inspection only | N/A | N/A |
| RENDER-05 | Minimap colors on tiles | Visual/inspection only | N/A — not implemented (see Open Questions) | N/A |
| RENDER-06 | Correct stacking order | Visual/inspection only | N/A — not implemented (see Open Questions) | N/A |

### Sampling Rate
- **Per task commit:** N/A (no tests exist)
- **Per wave merge:** Visual verification by loading game and inspecting tiles/creatures
- **Phase gate:** Visual verification confirms correct colors

### Wave 0 Gaps
No test infrastructure exists. Not required per D-04 decision. If tests are desired, they would need:
- A test framework install (vitest or jest)
- Test helper to load a small .spr file with known sprite colors
- Unit test for `decodeSprite` comparing output pixel values against expected RGBA

## Environment Availability

> **Step 2.6: SKIPPED** — This phase is a one-line code fix in `SpritesFile.ts` with no external dependencies. No tools, services, or runtimes beyond existing browser/node/npm are required. Rebuild command is `npx vite` (already in project).

## Sources
