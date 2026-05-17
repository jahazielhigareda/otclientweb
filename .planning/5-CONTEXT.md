# Phase 5 Context: Game Protocol Integration & World State

## Background

Phase 4 (Game World) established the structural skeleton:
- Canvas renderer with camera system ✅
- Basic GameManager with hardcoded player state ✅
- GameHUD with static HP/mana bars ✅
- GameLoop integration ✅
- ProtocolGame.ts with XTEA/RSA crypto ✅

However, **Phase 4 is functionally incomplete** — the protocol handler is unable to parse packets from the server after EnterGame, causing desync loops. Analysis of the error log confirms:

```
[ProtocolGame] Processing Opcode 0x1f (Encrypted=false)    ← Challenge OK
[ProtocolGame] Sending EnterGame for character: Knight      ← Response sent
[ProtocolGame] Unknown opCode. First byte: 0x35            ← Parsing fails
[ProtocolGame] Processing Opcode 0x82 (Encrypted=true)      ← Ambient found (known)
[ProtocolGame] Opcode 0x82 unhandled. Stopping loop.        ← But no handler case!
[ProtocolGame] Unknown opCode. First byte: 0xe4            ← Desync spiral
```

## Root Causes (from OTClient C++ reference)

| # | Problem | OTClient Reference |
|---|---------|-------------------|
| 1 | `handlePacket()` uses heuristic byte-offset guessing instead of deterministic sequential parsing | `protocolgameparse.cpp::parseMessage()` reads opcodes in a `while(!eof)` loop |
| 2 | Only 4/7+ opcodes have switch cases; ambient, textmsg, creatures all hit `default` + `return` which stops the parse loop | ~80 opcode handlers in OTClient |
| 3 | `parseFullMap()` skips all tile data without storing it | `setTileDescription()` builds actual `Tile` objects |
| 4 | Server movement/chat packets aren't handled, client actions aren't sent | `sendWalkNorth()`, `sendTalk()` etc. |
| 5 | No ping/pong heartbeat → connection drops | `sendPingBack()` on `GameServerPing` |
| 6 | GameManager data is hardcoded (pos 1000,1000), not server-driven | `LocalPlayer` updates from protocol |

## Goals

1. Fix protocol parsing so the client stays in sync with the game server
2. Store map data from server in a proper structure
3. Drive game state from server packets (player pos, HP/mana, creatures)
4. Enable keyboard movement via server commands
5. Enable chat send/receive
6. Maintain connection with ping heartbeat

## Decisions

- **Map Model**: Create `GameMap.ts` class (singleton) storing tiles as `Map<string, TileData>` keyed by `"x,y,z"`
- **Protocol Parsing**: Rewrite `handlePacket()` to sequentially read opcodes in a `while` loop matching OTClient's `parseMessage()` pattern
- **Handler Pattern**: Each opcode gets its own method (`parseWorldLight`, `parseTextMessage`, etc.)
- **Error Recovery**: Unknown opcodes are logged + skipped (not `return`), preventing desync
- **Movement**: WASD sends `ClientWalk*` opcodes via network
- **Chat**: SendTalk payload on Enter press, GameServerTalk → HUD messages
- **Heartbeat**: Respond to `GameServerPing` with `ClientPingBack`

## Technical Mapping (OTClient C++ → Web TS)

| OTClient C++ | OTCclientWeb TS |
|---|---|
| `protocolgameparse.cpp::parseMessage()` | `ProtocolGame.handlePacket()` rewrite — sequential opcode read loop |
| `protocolgameparse.cpp::parseWorldLight()` | New `ProtocolGame.parseWorldLight()` |
| `protocolgameparse.cpp::parseTextMessage()` | New `ProtocolGame.parseTextMessage()` |
| `protocolgameparse.cpp::parseCreatureMove()` | New `ProtocolGame.parseCreatureMove()` |
| `protocolgameparse.cpp::parsePlayerStats()` | New `ProtocolGame.parsePlayerStats()` |
| `protocolgamesend.cpp::sendWalkNorth()` etc | New `ProtocolGame.sendWalkNorth()` etc |
| `protocolgamesend.cpp::sendTalk()` | New `ProtocolGame.sendTalk()` |
| `protocolgamesend.cpp::sendPingBack()` | New `ProtocolGame.sendPingBack()` |
| `game.cpp / g_map` | `GameMap.ts` singleton |
| `tile.h / Tile` | `TileData` interface in GameMap |
| `localplayer.cpp / LocalPlayer` | `PlayerState` in GameManager (from server) |
| `protocolcodes.h` | Already exists as `ProtocolCodes.ts` (enum values match) |
