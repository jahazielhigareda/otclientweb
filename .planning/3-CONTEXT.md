# Phase 3 Context: Selección de Personajes

## Goals
Implement the character selection screen, allowing users to view their characters and choose one to enter the game world.

## Decisions
- **UI Design**:
    - List of characters with details (Name, Level, Vocation, Gender).
    - "Enter Game" button.
    - RPG-style list/grid with gothic borders.
- **Network Protocol**:
    - Request character list upon successful login.
    - Handle character list response (Number of characters, data for each).
    - Send "Select Character" packet.
- **State Integration**:
    - Transition to Phase 4 (Game World) upon selecting a character.

## Technical Mapping
- `protocolgame.cpp` (C++) $\rightarrow$ `NetworkManager.ts` additions for character selection.
- Character List Packet $\rightarrow$ Binary serialization using `Packet` class.
