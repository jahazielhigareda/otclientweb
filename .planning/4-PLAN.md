# Phase 4 Plan: Game World

## Objective
Implement the core game engine, rendering system, and HUD to provide a playable (albeit basic) game world environment.

## Tasks
1. **Implement Game Renderer**:
    - Create `src/core/GameRenderer.ts`.
    - Setup HTML5 Canvas for 2D tile rendering.
    - Implement a basic camera system (follow player).
    - Implement a simple `drawTile` and `drawPlayer` function.
2. **Implement GameManager**:
    - Create `src/core/GameManager.ts`.
    - Manage the current player state (Position, HP, Mana).
    - Handle input events and map them to player movement.
3. **Develop Game HUD**:
    - Create `src/ui/components/GameHUD.tsx`.
    - Implement HP/Mana bars.
    - Implement a basic chat window.
    - Implement hotkey indicators.
4. **Integrate Loop and Rendering**:
    - Update `GameLoop.ts` to trigger `GameRenderer.render()`.
    - Ensure smooth movement using interpolation between network updates.
5. **Verification**:
    - Verify the player can move using keyboard input.
    - Verify HUD updates reflect player state changes.
    - Verify Canvas renders a basic tilemap.

## Success Criteria
- Canvas renders a basic 2D world.
- Player movement is handled and reflected in the view.
- HUD displays real-time player statistics.
- Transition from `CHAR_SELECT` to `GAME` triggers the game engine initialization.
