# Phase 1 Context: Infraestructura Base

## Goals
Implement the core event and timing systems that power the entire client, mimicking OTClient's C++ architecture.

## Decisions
- **Language/Framework**: TypeScript + React + Vite.
- **Dispatcher Implementation**:
    - Singleton `Dispatcher` class.
    - Methods: `addEvent`, `scheduleEvent`, `cycleEvent`, `deferEvent`.
    - Integration: Tied to `requestAnimationFrame` to ensure synchronization with the browser's render cycle.
    - Event Queue: Events are processed in the order: Merge $\rightarrow$ Execute $\rightarrow$ Scheduled $\rightarrow$ Defer.
- **Timer Implementation**:
    - `Timer` class using `performance.now()` for millisecond precision.
    - Methods: `restart()`, `stop()`, `ticksElapsed()`.
- **State Management**: Simple React Context or a lightweight store (Zustand) to manage global client state (e.g., connection status).

## Technical Mapping (OTClient C++ $\rightarrow$ Web TS)
- `EventDispatcher::poll()` $\rightarrow$ `Dispatcher.poll()` called inside `requestAnimationFrame`.
- `ticks_t` $\rightarrow$ `number` (milliseconds).
- `g_dispatcher` $\rightarrow$ `Dispatcher` singleton.
- `BS::thread_pool` (AsyncDispatcher) $\rightarrow$ Native JS Promises and Async/Await.
