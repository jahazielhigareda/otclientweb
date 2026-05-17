export class Timer {
    private startTicks: number = 0;
    private stopped: boolean = false;

    constructor() {
        this.restart();
    }

    restart(shift: number = 0): void {
        this.startTicks = performance.now() + shift;
        this.stopped = false;
    }

    stop(): void {
        this.stopped = true;
    }

    update(tick: number): void {
        this.startTicks += tick;
    }

    getStartTicks(): number {
        return this.startTicks;
    }

    ticksElapsed(): number {
        if (this.stopped) {
            return -1;
        }
        return performance.now() - this.startTicks;
    }

    timeElapsed(): number {
        return this.ticksElapsed() / 1000.0;
    }

    running(): boolean {
        return !this.stopped;
    }
}
