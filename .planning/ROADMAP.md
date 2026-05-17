# Project Roadmap

## Phases
- [x] Phase 1: Infraestructura Base (Dispatcher y Timers)
- [x] Phase 2: Sistema de Login
- [x] Phase 3: Selección de Personajes
- [x] Phase 4: Game World (Entrada al Juego) — *Estructura básica: GameLoop, GameRenderer, GameHUD, ProtocolGame esqueleto*
- [ ] Phase 5: Game Protocol Integration & World State — *Protocolo funcional, estado del juego desde servidor, mapa, movimiento, chat*

### Phase 5: Game Protocol Integration & World State

**Goal:** Fix game protocol parsing to eliminate desync, wire server data to game state, enable keyboard movement and chat, add heartbeat.

**Plans:** 4 plans

**Requirements:**
- PROTO-01: Game protocol parses packets deterministically without desync
- PROTO-02: All critical server opcodes have handlers (ambient, text, creatures, ping, etc.)
- PROTO-03: Map data from server is stored in GameMap and rendered on canvas
- PROTO-04: Player state (position, HP, mana, level) is driven by server packets
- PROTO-05: WASD sends network movement commands
- PROTO-06: Chat works in both directions (send & receive)
- PROTO-07: Connection stays alive via ping/pong heartbeat

Plans:
- [x] 5-01 — Protocol Fix & Core Handlers (rewrite parsing, add opcode handlers)
- [x] 5-02 — Game State & Map (GameMap, game manager wiring, renderer updates)
- [x] 5-03 — Player Actions & Heartbeat (movement, chat, HUD, ping)
- [x] 5-04 — Sprite Rendering & Tile Storage (creature outfits, tile ground items)

### Phase 6: Sprite Renderer — Fix Map & Sprite Rendering

**Goal:** Fix sprite rendering pipeline so the game map displays correctly (tiles with proper ground sprites, creatures with correct outfits, no blue-tint/color corruption).

**Plans:** 2/2 plans complete

**Requirements:**
- RENDER-01: All tile sprites render with correct colors (no channel swap / blue tint)
- RENDER-02: Ground tiles display correct .spr sprites based on item IDs from server
- RENDER-03: Creature outfits render with correct colors and direction
- RENDER-04: Sprite cache works without visual artifacts (alpha, positioning)
- RENDER-05: Minimap colors render on tiles when available
- RENDER-06: Items on top of ground (objects, effects) render in correct stacking order

**Plans:**
- [x] 6-01 — Fix RGB channel swap in SpritesFile.ts decodeSprite() (Wave 1)
- [x] 6-02 — Add minimap color overlay + item stacking order (Wave 2)
