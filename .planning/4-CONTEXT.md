# Phase 4 Context: Game World

## Goals
Implement the core game loop, basic world representation, and the primary HUD/UI for the game state.

## Decisions
- **Game World Representation**:
    - 2D Tile-based rendering (canvas-based).
    - Basic camera system to follow the player.
    - Mapping of server coordinates to screen coordinates.
- **UI Components (HUD)**:
    - Health and Mana bars (RPG style).
    - Chat window (bottom).
    - Action bar / Hotkeys.
    - Inventory/Skills (basic placeholders).
- **Game Loop Integration**:
    - Connect the `GameLoop` to the rendering cycle.
    - Implement basic "heartbeat" with the server to maintain connection.
- **Input Handling**:
    - Keyboard support for movement (WASD/Arrows).
    - Mouse support for interacting with the world.

## Technical Mapping
- `renderer.cpp` (C++) $\rightarrow$ `GameRenderer.ts` (TS using HTML5 Canvas).
- `game.cpp` (C++) $\rightarrow$ `GameManager.ts` (TS).
- UI modules $\rightarrow$ React components overlaid on the Canvas.
