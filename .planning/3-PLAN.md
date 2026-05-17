# Phase 3 Plan: Selección de Personajes

## Objective
Implement the character selection flow, enabling users to view and select a character to enter the game.

## Tasks
1. **Extend Network Protocol**:
    - Update `NetworkManager.ts` to handle character list requests and responses.
    - Implement `sendSelectCharacter(charId: number)` method.
2. **Define Character Model**:
    - Create a `Character` interface (Name, Level, Vocation, etc.).
3. **Implement Character Selection UI**:
    - Create `src/ui/components/CharSelectWindow.tsx`.
    - Implement a list to display characters.
    - Add "Enter Game" button that sends the selection packet.
4. **State Integration**:
    - Update `ClientState` to handle transition from `CHAR_SELECT` $\rightarrow$ `GAME`.
    - trigger character list fetch when entering `CHAR_SELECT`.
5. **Verification**:
    - Mock server response with a list of 3 characters.
    - Verify that clicking "Enter Game" triggers the transition to the game world.

## Success Criteria
- The character list is correctly fetched and displayed.
- Selecting a character and clicking "Enter Game" sends the correct packet.
- UI maintains the RPG aesthetic.
- Screen transition from `CHAR_SELECT` to `GAME` works.
