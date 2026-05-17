---
phase: 06
slug: sprite-renderer-fix-map-sprite-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript (tsc) + Vite dev server |
| **Config file** | client/tsconfig.json |
| **Quick run command** | `npx tsc -b --noEmit` |
| **Full suite command** | `npx tsc -b --noEmit && npx vite build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc -b --noEmit`
- **After every plan wave:** Run full build
- **Before verification:** Full build must be green
- **Max feedback latency:** 30 seconds

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | RENDER-01, RENDER-02, RENDER-03, RENDER-04 | build | `npx tsc -b --noEmit` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | RENDER-01, RENDER-02, RENDER-03, RENDER-04 | visual | N/A (human) | N/A | ⬜ pending |
| 06-02-01 | 02 | 2 | RENDER-05 | build | `npx tsc -b --noEmit` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 2 | RENDER-06 | build | `npx tsc -b --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — TypeScript compiler + Vite.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sprite colors correct | RENDER-01 | Visual-only — no automated screenshot comparison | 1. Start proxy: `node proxy.js` 2. Start Vite: `npx vite` (in client/) 3. Login, select char, enter game 4. Verify ground tiles and creatures have correct colors (not blue-tinted) |
| Creature outfit colors | RENDER-03 | Visual-only | Same setup — observe creature sprites |

---

## Validation Sign-Off

- [ ] All tasks have `tsc` verify
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
