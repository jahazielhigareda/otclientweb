---
phase: "05-game-protocol"
plan: "01"
type: "execute"
wave: 1
depends_on: []
files_modified:
  - "client/src/network/protocols/ProtocolGame.ts"
  - "client/src/network/ProtocolCodes.ts"
autonomous: true
must_haves:
  truths:
    - "Client stays connected to game server without desync loops"
    - "World light/ambient updates are parsed and logged"
    - "Text messages from server appear in console"
    - "Creature appearances/movements are parsed"
    - "Player stats (HP, mana, pos) are parsed from server packets"
    - "Map tiles are parsed and position data extracted"
    - "Server pings are responded to (heartbeat)"
  artifacts:
    - path: "client/src/network/protocols/ProtocolGame.ts"
      provides: "Fixed game protocol with all critical opcode handlers"
      min_lines: 350
    - path: "client/src/network/ProtocolCodes.ts"
      provides: "Correct enum values for game protocol"
      min_lines: 350
  key_links:
    - from: "ProtocolGame.handlePacket"
      to: "Packet.readUint8 loop"
      pattern: "while.*packet.*eof|while.*offset.*length"
    - from: "ProtocolGame"
      to: "NetworkManager"
      via: "connection.onmessage callback"
---

<objective>
Fix the game protocol parsing to eliminate desync loops and handle all critical server packets after entering the game world.

**Purpose:** The current ProtocolGame.ts uses heuristic byte-offset guessing for packet parsing and only handles 4 opcodes. When the server sends Ambient (0x82), TextMessage (0xB4), Ping, or creature data, the handler either can't find the opcode or hits the `default` case and calls `return`, which stops the parse loop mid-packet. This causes immediate desync.

**Output:** Rewritten ProtocolGame.ts with deterministic sequential packet parsing and handlers for essential game opcodes: LoginSuccess, FullMap, PlayerData, WorldLight, TextMessage, CreatureData, CreatureMove, Ping, PlayerSkills, PlayerState.
</objective>

<context>
@.planning/4-PLAN.md
@.planning/4-CONTEXT.md
@.planning/5-CONTEXT.md

**Key reference — OTClient parseMessage structure (protocolgameparse.cpp):**
```
while (!msg->eof()) {
    opcode = msg->getU8();         // read opcode byte
    switch (opcode) {
        case Proto::GameServerAmbient: parseWorldLight(msg); break;
        case Proto::GameServerTextMessage: parseTextMessage(msg); break;
        // ... ~80 cases
        default:                    // log + skip, DO NOT return
            g_logger.warning("unhandled opcode 0x%02X", opcode);
            msg->setReadPos(msg->getMessageSize()); // drain rest
            break;
    }
}
```

**Key insight:** The `default` case does NOT `return` — it skips remaining bytes and continues. The OTClient parses one opcode at a time, sequentially. Our current code breaks this pattern.

**Current ProtocolGame.ts issues:**
1. `handlePacket()` slices at byte 2, then tries `payload[4]`, `payload[6]`, `decrypted[0]`, `decrypted[2]` — heuristic offsets
2. `processPacket()` has a `while` loop but breaks on first `default` case via `return`
3. Only 7 opcodes in `isKnownOpcodes` but only 4 have switch cases
4. XTEA decryption and envelope handling is mixed with opcode detection
</context>

<interfaces>
From client/src/network/Protocol.ts:
```typescript
export abstract class Protocol {
    protected connection: Connection;
    abstract handlePacket(data: ArrayBuffer): void;
}
```

From client/src/network/Packet.ts (relevant methods):
```typescript
class Packet {
    readUint8(): number;
    readUint16(): number;
    readUint32(): number;
    readString(): string;
    readBytes(length: number): Uint8Array;
    peekUint16(): number;  // (needed: read without advancing offset)
    getOffset(): number;
    getBinary(): Uint8Array;
}
```

From client/src/network/types.ts:
```typescript
export interface Character { name: string; world: string; ip: string; port: number; previewState: boolean; }
```

**Note:** Packet.ts lacks a `peekUint16()` method and a way to check remaining bytes. These may need to be added.
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>task 1: Rewrite handlePacket with deterministic sequential parsing</name>
  <files>
    client/src/network/protocols/ProtocolGame.ts
    client/src/network/Packet.ts
  </files>
  <action>
    Rewrite `ProtocolGame.handlePacket()` to parse the protocol envelope deterministically:

    **Envelope Structure (from proxy.js framing):**
    Raw message from WebSocket: [uint16 size LE][adler32 4 bytes][payload...]
    When encrypted: payload = [XTEA([uint16 innerSize LE][innerPayload...])]
    
    **New algorithm:**
    1. `data` is the raw ArrayBuffer from WebSocket (already framed by proxy)
    2. `payload = new Uint8Array(data)` — the proxy sends complete packets
    3. The checksum is bytes 0-3, encrypted data starts at byte 4
    4. If `encryptionEnabled`: XTEA-decrypt from byte 4, get `innerSize` from decrypted[0-1], then opcodes start at decrypted[2]
    5. If NOT encrypted: opcodes start at byte 4
    6. Feed the opcode region into a new `Packet` and call `processPacket()`
    
    **Simplify:** Remove all the heuristic offset guessing (payload[4], payload[6], decrypted[0] vs decrypted[2]). The structure is:
    - When encrypted: XTEA decrypt `data.slice(4)` → decrypted → `innerSize = decrypted[0..1]` → opcodes start at `decrypted[2]`
    - When not encrypted: opcodes start at `data[4]`

    Also add to `Packet.ts`:
    - `canRead(length: number): boolean` — returns `this.offset + length <= this.buffer.byteLength`
    - `skipBytes(count: number): void` — advances offset
    - `peekUint16()` — reads uint16 without advancing offset
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr /V "TS" | head -20</automated>
  </verify>
  <done>
    ProtocolGame.handlePacket reads exactly one opcode region, creates one Packet, and delegates to processPacket
  </done>
</task>

<task type="auto" tdd="false">
  <name>task 2: Fix processPacket loop — sequential opcode reading with proper handlers</name>
  <files>
    client/src/network/protocols/ProtocolGame.ts
  </files>
  <action>
    Rewrite `processPacket()` to read opcodes sequentially and NEVER call `return` on unknown opcodes:

    **Critical rules:**
    1. Read opcodes in a `while (packet.canRead(1))` loop
    2. Unknown opcodes → `console.warn` + `continue` (NOT return)
    3. Add switch cases for ALL these opcodes:

    ```typescript
    case GameServerOpcodes.GameServerChallenge (0x1F/31):
        // Already exists — parse challengeTimestamp + random, call sendEnterGame()
    
    case GameServerOpcodes.GameServerLoginSuccess (0x17/23):
        // Already exists — parse playerId + serverBeat
    
    case GameServerOpcodes.GameServerFullMap (0x64/100):
        // Already exists — calls parseFullMap(packet)
    
    case GameServerOpcodes.GameServerPlayerData (0xA0/160):
        // Already exists — read HP, maxHP, etc.
    
    case GameServerOpcodes.GameServerAmbient (0x82/130):
        // NEW — read uint8 (light level), uint8 (color), console.log
    
    case GameServerOpcodes.GameServerTextMessage (0xB4/180):
        // NEW — read uint8 (message type), read uint16 (channel?), read string (message), console.log
        // Channel/extra data depends on protocol version — for 8.60 it's just: [u8 type][string message]
    
    case GameServerOpcodes.GameServerPlayerDataBasic (0x9F/159):
        // NEW — read uint32 (experience), uint16 (level), uint8 (levelPercent), console.log
    
    case GameServerOpcodes.GameServerPlayerSkills (0xA1/161):
        // NEW — read all 7 skills as uint16 + uint8 percent, console.log
    
    case GameServerOpcodes.GameServerPlayerState (0xA2/162):
        // NEW — read uint8 (states bitmask), console.log
    
    case GameServerOpcodes.GameServerPing (0x1E/30):
        // NEW — send PingBack response
    
    case GameServerOpcodes.GameServerPingBack (0x1D/29):
        // NEW — console.log
    
    case GameServerOpcodes.GameServerCreatureData (0x8B/139):
        // NEW — read creature data (id, name, health, etc.), console.log
    
    case GameServerOpcodes.GameServerCreatureHealth (0x8C/140):
        // NEW — read creatureId + healthPercent, console.log
    
    case GameServerOpcodes.GameServerCreatureOutfit (0x8E/142):
        // NEW — read creatureId + outfit bytes, console.log
    
    case GameServerOpcodes.GameServerCreatureSpeed (0x8F/143):
        // NEW — read creatureId + speed, console.log
    
    case GameServerOpcodes.GameServerMoveCreature (0x6D/109):
        // NEW — parse creature movement (leaveTilePos, arriveTilePos), console.log
    
    case GameServerOpcodes.GameServerCreateOnMap (0x6A/106):
        // NEW — read pos + thing and log creature appearing
    
    case GameServerOpcodes.GameServerDeleteOnMap (0x6C/108):
        // NEW — read pos + stackpos, log removal
    
    case GameServerOpcodes.GameServerUpdateTile (0x69/105):
        // NEW — log tile updates
    
    case GameServerOpcodes.GameServerSetInventory (0x78/120):
        // NEW — read slot + item data, log
    
    case GameServerOpcodes.GameServerGraphicalEffect (0x83/131):
        // NEW — read pos + type + ... log but skip for now
    
    case GameServerOpcodes.GameServerMissleEffect (0x85/133):
        // NEW — parse missile data, log
    
    case GameServerOpcodes.GameServerFloorChangeUp (0xBE/190):
    case GameServerOpcodes.GameServerFloorChangeDown (0xBF/191):
        // NEW — log floor change
    ```

    **Important:** The `GameServerOpcodes` enum in ProtocolCodes.ts already has all these values (e.g., `GameServerAmbient = 130`). Reference them by enum, not by hex literal.

    **After adding handlers, remove dead code:**
    - Remove `isKnownOpcode()` method (no longer needed — we log+continue unknown opcodes)
    - Remove the heuristic packet-offset logic (replaced by deterministic structure above)

    **Add new send methods:**
    - `sendPingBack()`: sends `[0x1E]` (ClientPingBack) via connection
    
    **Fix sendEnterGame:**
    - The current sendEnterGame sends opcode 0x0A (SelectedCharacter) but looking at OTClient `protocolgamesend.cpp::sendEnterGame()`, the correct opcode is `Proto::ClientEnterGame = 15`. The 0x0A is from a different protocol version. Send `0x0F` (ClientEnterGame = 15) instead.
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr "error"</automated>
  </verify>
  <done>
    processPacket reads opcodes sequentially in a while loop; all critical opcodes have switch cases; unknown opcodes are logged but don't stop parsing; desync loop is eliminated.
  </done>
</task>

<task type="auto" tdd="false">
  <name>task 3: Rewrite map/thing parsing to capture positional data</name>
  <files>
    client/src/network/protocols/ProtocolGame.ts
  </files>
  <action>
    Rewrite map parsing methods to properly extract and log map data rather than skipping everything:

    **Fix `parseFullMap()`:**
    - The OT protocol 8.60 sends: [uint16 posX][uint16 posY][uint8 posZ][tile data for a viewport around player]
    - The viewport is typically: z=7→0 (8 floors), each floor is 18 tiles wide × 14 tiles high
    - Replace the hardcoded `18` and `14` with constants: `MAP_WIDTH = 18`, `MAP_HEIGHT = 14`
    - For each tile, call `parseTileDescription()` and log the position of any creatures/items found
    - Log a summary: `[ProtocolGame] Map parsed: {tileCount} tiles containing {creatureCount} creatures at base ({x},{y},{z})`

    **Fix `parseTileDescription()`:**
    - The OT protocol 8.60 tile format: stream of `Thing` entries until a skip mark (≥ 0xFF00) is found
    - Keep the existing peek logic for 0xFF00 skip
    - Count tile contents and return count

    **Fix `parseThing()`:**
    - Creature IDs 0x61/0x62/0x63 detection works for 8.60
    - For creatures: extract name, position info and log it
    - For items: read the item ID. Items have an `isStackable` property → if stackable, read extra uint8 count
    - Return `{ type: 'creature' | 'item', id: number, name?: string }` so callers can use the data
    - IMPORTANT: In 8.60, creatures use 0x61 (KnownCreature), 0x62 (UnknownCreature), 0x63 (OutdatedCreature). The old code checks if id is in [0x61, 0x62, 0x63], but these are 16-bit values. In 8.60, the creature opcodes are sent as 16-bit values in the tile stream. Verify this matches the proxy data.
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr "error"</automated>
  </verify>
  <done>
    parseFullMap extracts player spawn position, tile data is parsed without errors, creature appearances are logged
  </done>
</task>

</tasks>

<verification>
1. `npx tsc -b --noEmit` compiles without errors
2. Manual test: Connect to server via proxy, observe console output after character selection — no desync loop, server packets parsed sequentially
3. Heartbeat: Server ping triggers PingBack send
</verification>

<success_criteria>
- ProtocolGame connects to game world, processes packets without desync
- All critical opcodes (Ambient, TextMessage, CreatureMove, PlayerData, Ping, etc.) have working handlers
- Map parsing doesn't throw errors and logs player spawn position
- TypeScript compilation passes
- The "Opcode 0x82 unhandled. Stopping loop" error is eliminated
</success_criteria>
