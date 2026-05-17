# Phase 2 Context: Sistema de Login

## Goals
Implement the authentication flow, connecting the client to the OpenTibia server.

## Decisions
- **UI Design**:
    - RPG-style login window.
    - Fields: Account name, Password.
    - Buttons: Login, Cancel.
    - Styling: Dark theme, gothic/medieval borders.
- **Network Protocol**:
    - Use TCP sockets (via WebSockets/Proxy since browsers cannot open raw TCP).
    - *Note*: I will implement the protocol logic in a way that it can be bridged by a proxy (like `otclient-proxy` or similar).
    - Login Sequence: `Client -> Server (Login Packet) -> Server (Welcome/CharList)`.
- **State Integration**:
    - Dispatcher will be used to handle asynchronous network responses.
    - Transition to Phase 3 (Character Selection) upon successful login.

## Technical Mapping
- `httplogin.cpp` (C++) $\rightarrow$ `NetworkManager.ts` (TS) using Fetch/WebSockets.
- Login Packets $\rightarrow$ Binary serialization using `DataView` or `Buffer`.
