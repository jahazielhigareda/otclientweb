# Phase 6: Sprite Renderer — Fix Map & Sprite Rendering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 06-sprite-renderer
**Areas discussed:** Root cause hypothesis

---

## Root Cause Hypothesis

| Option | Description | Selected |
|--------|-------------|----------|
| Red and blue are swapped | Ground tiles that should be brown/green/stone appear blue/purple. Red elements are missing or cyan-tinted. | ✓ |
| Blue overlay | Everything has a blue overlay but content somewhat distinguishable | |
| Need diagnostics first | Not sure — build a diagnostic tool first | |

**User's choice:** Red and blue are swapped
**Notes:** Confirmed the hypothesis — the SPR decode reads pixel data as B,G,R but the .spr file stores RGB format. The background color bytes are read correctly as R,G,B, creating an inconsistency.

## Fix Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fix and verify | Fix decodeSprite() pixel byte order, rebuild, verify visually | ✓ |
| Add diagnostic log first | Log first sprite's pixel values before and after fix | |

**User's choice:** Fix and verify
**Notes:** The fix is a one-line change of variable bindings in the colored pixel loop. After fix, visually verify by loading the game.

## OpenCode's Discretion

- Diagnostic logging verbosity (if fix is insufficient)
- Additional rendering investigation (if channel swap fix isn't the full answer)

## Deferred Ideas

None
