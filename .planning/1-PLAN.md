# Phase 1 Plan: Infraestructura Base

## Objective
Implement the core event loop and timing system to enable a predictable, frame-based execution environment similar to OTClient.

## Tasks
1. **Project Initialization**:
    - Setup Vite + React + TypeScript project in `C:\git\otclientweb`.
    - Configure folder structure: `src/core`, `src/ui`, `src/network`.
2. **Implement Timer Class**:
    - Create `src/core/Timer.ts`.
    - Implement `restart()`, `stop()`, `running()`, `ticksElapsed()`.
    - Use `performance.now()` for timestamps.
3. **Implement Dispatcher Class**:
    - Create `src/core/Dispatcher.ts`.
    - Implement event queues for `events`, `scheduledEvents`, `deferEvents`.
    - Implement `addEvent(cb)`, `scheduleEvent(cb, delay)`, `cycleEvent(cb, delay)`, `deferEvent(cb)`.
    - Implement `poll()` method to process queues in correct order.
4. **Implement Game Loop**:
    - Create `src/core/GameLoop.ts`.
    - Use `requestAnimationFrame` to call `Dispatcher.poll()` every frame.
    - Initialize the loop on application start.
5. **Verification**:
    - Create a test script or simple UI component to verify:
        - `addEvent` runs on the next frame.
        - `scheduleEvent` runs after the specified delay.
        - `cycleEvent` repeats correctly.
        - `Timer` reports accurate elapsed time.

## Success Criteria
- `Dispatcher` singleton is available globally.
- `poll()` is called consistently via `requestAnimationFrame`.
- All event types (`add`, `schedule`, `cycle`, `defer`) function as expected.
- `Timer` provides millisecond accuracy.
