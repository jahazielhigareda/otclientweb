---
phase: "05-game-protocol"
plan: "02"
type: "execute"
wave: 2
depends_on: ["05-game-protocol-01"]
files_modified:
  - "client/src/core/GameMap.ts"
  - "client/src/core/GameManager.ts"
  - "client/src/core/GameRenderer.ts"
  - "client/src/network/protocols/ProtocolGame.ts"
  - "client/src/network/types.ts"
autonomous: true
must_haves:
  truths:
    - "Player position is set from server data, not hardcoded"
    - "HP/mana values are updated from server packets"
    - "Game map stores parsed tile data from server"
    - "Creatures parsed from server appear in game state"
    - "Renderer reads from actual map data, not hardcoded grid"
    - "Camera centers on player's server-reported position"
  artifacts:
    - path: "client/src/core/GameMap.ts"
      provides: "Tile storage and lookup"
      min_lines: 80
    - path: "client/src/core/GameManager.ts"
      provides: "Server-driven player state"
      min_lines: 100
    - path: "client/src/core/GameRenderer.ts"
      provides: "Render tiles from GameMap, render creature dots"
      min_lines: 80
  key_links:
    - from: "ProtocolGame"
      to: "GameManager"
      via: "static instance update calls"
      pattern: "g_gameManager\\.player\\."
    - from: "ProtocolGame"
      to: "GameMap"
      via: "setTile / addCreature calls"
      pattern: "g_gameMap\\."
    - from: "GameManager.update"
      to: "GameRenderer.render"
      via: "player state passed to render"
---

<objective>
Create server-driven game state management: GameMap for tile storage, GameManager wired to real server data, and GameRenderer updated to display actual map content.

**Purpose:** Currently GameManager has hardcoded player position and stats. GameRenderer shows a generic grid. ProtocolGame parses server data but discards it (only logs it). We need to connect these so the game world reflects the actual server state.

**Output:** GameMap.ts with tile storage, refactored GameManager with server-driven state, updated Renderer that displays real map data, and wiring in ProtocolGame to push parsed data into the game state.
</objective>

<context>
@.planning/5-CONTEXT.md
@.planning/5-01-PLAN.md
@client/src/core/GameManager.ts
@client/src/core/GameRenderer.ts
@client/src/network/protocols/ProtocolGame.ts
@client/src/core/GameLoop.ts

**Current state of GameManager:**
```typescript
export interface PlayerState {
    x: number; y: number; hp: number; maxHp: number; mana: number; maxMana: number;
}
export class GameManager {
    public player: PlayerState = { x: 1000, y: 1000, hp: 100, maxHp: 100, mana: 50, maxMana: 50 };
    init(): void { g_gameRenderer.init('game-canvas'); window.addEventListener('keydown', (e) => this.handleInput(e)); }
    private handleInput(e: KeyboardEvent): void {
        const speed = 5;
        switch (e.key.toLowerCase()) {
            case 'w': this.player.y -= speed; break;
            case 's': this.player.y += speed; break;
            case 'a': this.player.x -= speed; break;
            case 'd': this.player.x += speed; break;
        }
    }
    update(): void { g_gameRenderer.render(this.player); }
}
```

**Key problem:** Movement is local-only (pixel-based, speed=5). Player position is fake (1000,1000). HP/mana are fake (100/50). No map data feeds the renderer.
</context>

<interfaces>
From client/src/network/types.ts:
```typescript
export interface Character {
    name: string;
    world: string;
    ip: string;
    port: number;
    previewState: boolean;
}
```

Current GameManager exports:
```typescript
export interface PlayerState { x: number; y: number; hp: number; maxHp: number; mana: number; maxMana: number; }
export class GameManager { static getInstance(): GameManager; player: PlayerState; init(): void; update(): void; }
export const g_gameManager: GameManager;
```
</interfaces>

<tasks>

<task type="auto">
  <name>task 1: Create GameMap with tile storage and creature tracking</name>
  <files>
    client/src/core/GameMap.ts
    client/src/network/types.ts
  </files>
  <action>
    Create `client/src/core/GameMap.ts` — a singleton that stores game world data:

    ```typescript
    // Tile in the game map — each position can have ground + items + at most 1 creature
    export interface TileData {
        position: { x: number; y: number; z: number };
        groundId?: number;       // item ID of ground tile
        creatureId?: number;     // creature on this tile (0 = none)
        creatureName?: string;
        creatureHealthPercent?: number;
        minimapColor?: number;
    }

    export interface CreatureData {
        id: number;
        name: string;
        position: { x: number; y: number; z: number };
        healthPercent: number;
        direction: number;
        speed: number;
        outfit?: { lookType: number; head: number; body: number; legs: number; feet: number; addons: number };
    }

    export class GameMap {
        private static instance: GameMap;
        private tiles: Map<string, TileData>;     // key: "x,y,z"
        private creatures: Map<number, CreatureData>; // key: creatureId

        static getInstance(): GameMap;
        
        // Tile operations
        setTile(x: number, y: number, z: number, data: Partial<TileData>): void;
        getTile(x: number, y: number, z: number): TileData | undefined;
        removeTile(x: number, y: number, z: number): void;
        hasTile(x: number, y: number, z: number): boolean;
        
        // Creature operations
        addCreature(id: number, name: string, x: number, y: number, z: number, healthPercent: number, direction: number): void;
        removeCreature(id: number): void;
        moveCreature(id: number, fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number): void;
        updateCreatureHealth(id: number, healthPercent: number): void;
        getCreature(id: number): CreatureData | undefined;
        getAllCreatures(): CreatureData[];
        
        // Query
        getTilesInViewport(centerX: number, centerY: number, centerZ: number, width: number, height: number): TileData[];
        clear(): void;
        
        // Helper
        private key(x: number, y: number, z: number): string;
    }

    export const g_gameMap = GameMap.getInstance();
    ```

    Add to `types.ts`:
    ```typescript
    export interface TilePosition { x: number; y: number; z: number; }
    ```
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr "error" | head -5</automated>
  </verify>
  <done>
    GameMap.ts compiles, exports g_gameMap singleton, implements all tile/creature CRUD operations
  </done>
</task>

<task type="auto">
  <name>task 2: Refactor GameManager with server-driven state and wire ProtocolGame to it</name>
  <files>
    client/src/core/GameManager.ts
    client/src/network/protocols/ProtocolGame.ts
  </files>
  <action>
    Refactor `GameManager.ts` to be driven by server data instead of hardcoded values:

    **Changes to GameManager:**
    ```typescript
    export interface PlayerState {
        id: number;
        x: number;
        y: number;
        z: number;
        hp: number;
        maxHp: number;
        mana: number;
        maxMana: number;
        level: number;
        experience: number;
        capacity: number;
        soul: number;
        stamina: number;
        magicLevel: number;
    }
    ```

    - Remove hardcoded position (1000,1000)
    - Remove local-only keyboard movement handler (will be replaced by network sends in plan 5-03)
    - Add `updatePlayer(data: Partial<PlayerState>)` method
    - Add `setPosition(x, y, z)` method
    - Keep `update()` calling `g_gameRenderer.render()` — renderer now reads from GameMap + GameManager
    - Remove `handleInput()` (moved to plan 5-03)
    - `init()` should still initialize renderer and register listener

    **Wire ProtocolGame to push parsed data into GameManager and GameMap:**
    
    In `ProtocolGame.processPacket()`, for each handler case:
    
    - `GameServerLoginSuccess (0x17/23)`: After parsing playerId, store it:
      ```typescript
      g_gameManager.updatePlayer({ id: playerId });
      ```
    
    - `GameServerPlayerData (0xA0/160)`: 
      ```typescript
      g_gameManager.updatePlayer({
          hp: packet.readUint16(),
          maxHp: packet.readUint16(),
          capacity: packet.readUint32(),
          experience: packet.readUint32(),
          level: packet.readUint16(),
          levelPercent: packet.readUint8(),
          mana: packet.readUint16(),
          maxMana: packet.readUint16(),
          magicLevel: packet.readUint8(),
          magicLevelPercent: packet.readUint8(),
          soul: packet.readUint8(),
          stamina: packet.readUint16(),
      });
      ```
    
    - `GameServerFullMap (0x64/100)`: After calling `parseFullMap()`, the parsed position should set player position:
      ```typescript
      // parseFullMap returns the base position
      const { x, y, z } = this.parseFullMap(packet);
      g_gameManager.setPosition(x, y, z);
      ```
    
    - `GameServerCreatureData (0x8B/139)`:
      ```typescript
      const creatureId = packet.readUint32();
      const name = packet.readString();
      const health = packet.readUint8(); // percent
      const direction = packet.readUint8();
      // ... outfit bytes
      const x = packet.readUint16();
      const y = packet.readUint16();
      const z = packet.readUint8();
      g_gameMap.addCreature(creatureId, name, x, y, z, health, direction);
      ```
    
    - `GameServerMoveCreature (0x6D/109)`:
      ```typescript
      const fromX = packet.readUint16();
      const fromY = packet.readUint16();
      const fromZ = packet.readUint8();
      const toX = packet.readUint16();
      const toY = packet.readUint16();
      const toZ = packet.readUint8();
      g_gameMap.moveCreature(0 /*get from tile*/, fromX, fromY, fromZ, toX, toY, toZ);
      ```
    
    - `GameServerDeleteOnMap (0x6C/108)`:
      ```typescript
      const x = packet.readUint16();
      const y = packet.readUint16();
      const z = packet.readUint8();
      const stackpos = packet.readUint8();
      g_gameMap.removeTile(x, y, z);
      ```
    
    - `GameServerPlayerDataBasic (0x9F/159)`:
      ```typescript
      g_gameManager.updatePlayer({
          experience: packet.readUint64(), // actually readUint32 for 8.60
          level: packet.readUint16(),
          levelPercent: packet.readUint8(),
      });
      ```

    **IMPORTANT:** Import g_gameMap and g_gameManager at top of ProtocolGame.ts:
    ```typescript
    import { g_gameManager } from '../../core/GameManager';
    import { g_gameMap } from '../../core/GameMap';
    ```

    **Note for parseFullMap:** After parsing all tiles, return the base position:
    ```typescript
    private parseFullMap(packet: Packet): { x: number; y: number; z: number } {
        const x = packet.readUint16();
        const y = packet.readUint16();
        const z = packet.readUint8();
        // ... parse tiles ...
        return { x, y, z };
    }
    ```
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr "error" | head -10</automated>
  </verify>
  <done>
    GameManager.player is initialized with default values, updated by ProtocolGame handlers; GameMap stores parsed tiles/creatures; TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>task 3: Update GameRenderer to render actual map tiles and creatures</name>
  <files>
    client/src/core/GameRenderer.ts
    client/src/core/GameManager.ts
  </files>
  <action>
    Update `GameRenderer.ts` to use real game data:

    **Changes:**
    1. Import g_gameMap:
       ```typescript
       import { g_gameMap } from './GameMap';
       ```
    
    2. Change `render(playerPos)` to `render()` — read player position from GameManager:
       ```typescript
       render(): void {
           const player = g_gameManager.player;
           const centerX = player.x * 32;  // tile position to pixel position
           const centerY = player.y * 32;
           // ... camera logic
       }
       ```
    
    3. Replace the grid-drawing code with tile rendering:
       ```typescript
       // Get tiles in viewport from GameMap
       const viewTiles = g_gameMap.getTilesInViewport(player.x, player.y, player.z, 10, 10);
       
       // Draw ground tiles
       for (const tile of viewTiles) {
           const screenX = (tile.position.x * 32) - this.camera.x;
           const screenY = (tile.position.y * 32) - this.camera.y;
           
           // Draw ground (green/brown tones based on minimapColor)
           this.ctx.fillStyle = tile.groundId ? '#2a3a1a' : '#1a1a1a';
           this.ctx.fillRect(screenX, screenY, 32, 32);
           
           // Subtle grid lines
           this.ctx.strokeStyle = '#1a2a1a';
           this.ctx.strokeRect(screenX, screenY, 32, 32);
       }
       ```
    
    4. Draw creatures from GameMap:
       ```typescript
       const creatures = g_gameMap.getAllCreatures();
       for (const creature of creatures) {
           const screenX = (creature.position.x * 32 + 16) - this.camera.x;
           const screenY = (creature.position.y * 32 + 16) - this.camera.y;
           
           // Draw creature as colored circle
           this.ctx.beginPath();
           this.ctx.arc(screenX, screenY, 12, 0, Math.PI * 2);
           this.ctx.fillStyle = creature.name === 'Knight' ? '#4af' : '#f44';
           this.ctx.fill();
           this.ctx.strokeStyle = '#fff';
           this.ctx.stroke();
           
           // Draw name above creature
           this.ctx.fillStyle = '#fff';
           this.ctx.font = '10px sans-serif';
           this.ctx.textAlign = 'center';
           this.ctx.fillText(creature.name, screenX, screenY - 18);
       }
       ```
    
    5. Remove the old grid rendering (startX/startY loop)

    **Update GameManager:**
    Change `update()` to call `render()` without arguments:
    ```typescript
    update(): void {
        g_gameRenderer.render();
    }
    ```
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr "error" | head -10</automated>
  </verify>
  <done>
    Renderer reads from GameMap tile data and GameManager player state; tiles are rendered as colored squares; creatures render as colored circles with names; compilation passes
  </done>
</task>

</tasks>

<verification>
1. `npx tsc -b --noEmit` compiles without errors
2. Manual test: Connect to game world — map tiles appear on canvas, player position reflects server data
3. HP/mana bars show parsed values, not hardcoded 100/50
</verification>

<success_criteria>
- GameMap stores and retrieves tile and creature data correctly
- GameManager player state is initialized to defaults and updated via ProtocolGame calls
- GameRenderer draws ground tiles from GameMap data (not generic grid)
- Creatures appear as colored circles on the map with names
- Player position from server drives the camera center
- TypeScript compilation passes
</success_criteria>
