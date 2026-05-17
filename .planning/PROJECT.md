# Project: otclientweb
A complete web client for OpenTibia (OT), replicating the architecture of OTClient (C++).

## Core Architecture Goals
- **Dispatcher Pattern**: Centralized event queue (addEvent, scheduleEvent, cycleEvent, deferEvent).
- **Timer System**: Precision timing for game mechanics.
- **State Management**: Global client state (Connection -> Login -> CharSelect -> Game).
- **UI**: RPG-style interface.
