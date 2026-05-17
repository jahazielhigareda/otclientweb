# Phase 2 Plan: Sistema de Login

## Objective
Implement the user authentication flow, including the UI and the network protocol to communicate with an OpenTibia server.

## Tasks
1. **Network Layer Implementation**:
    - Create `src/network/NetworkManager.ts`.
    - Implement WebSocket connection logic.
    - Create a `Packet` utility class for binary data handling (Read/Write).
2. **Login Protocol Logic**:
    - Implement the login packet structure.
    - Implement handlers for server responses (Success, Error, Welcome).
3. **Login UI Development**:
    - Create `src/ui/components/LoginWindow.tsx`.
    - Implement form handling (Account/Password).
    - Apply RPG styling (borders, fonts, background).
4. **State Integration**:
    - Create a `ClientState` provider to manage the current screen (Login $\rightarrow$ CharSelect).
    - Integrate `LoginWindow` with `NetworkManager`.
5. **Verification**:
    - Mock server response to verify UI transition from Login to Character Selection.
    - Verify packet serialization matches OT protocol.

## Success Criteria
- User can enter credentials and click "Login".
- The client sends a correctly formatted binary packet.
- The client reacts to a "Login Success" mock response by switching the screen.
- UI adheres to the RPG aesthetic.
