---
plan: 06-01
phase: 06-sprite-renderer
executed: 2026-05-14
status: complete
wave: 1
checkpoints:
  - task: 2
    type: human-verify
    result: approved
    note: "Colors confirmed correct — grass green, no blue tint"
---

## Summary

Fixed the red-blue channel swap in `SpritesFile.ts:decodeSprite()` — changed pixel byte read order from B,G,R to R,G,B to match .spr file format.

### Key Changes

- **SpritesFile.ts:65-67** — Changed `const b = ... const g = ... const r = ...` to `const r = ... const g = ... const b = ...`
- Lines 68-71 (pixel assignment) — unchanged (already R,G,B,A)
- Lines 39-41 (background color read) — unchanged (already R,G,B)

### Verification

- `npx tsc -b --noEmit` ✅ passes
- `grep` confirms: `const r = dv.getUint8` at line 65, `const g = ...` at line 66, `const b = ...` at line 67
- Human visual verification ✅ — sprites display with natural colors

### Files Modified

1. `client/src/core/SpritesFile.ts`

### Commits

1. `aaf2d3e` — fix: correct RGB byte order in SpritesFile.ts decodeSprite()
