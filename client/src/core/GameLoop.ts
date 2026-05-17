import { g_dispatcher } from './Dispatcher';
import { g_gameManager } from './GameManager';

export class GameLoop {
    private static instance: GameLoop;
    private running: boolean = false;

    private constructor() {}

    public static getInstance(): GameLoop {
        if (!GameLoop.instance) {
            GameLoop.instance = new GameLoop();
        }
        return GameLoop.instance;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.loop();
    }

    stop(): void {
        this.running = false;
    }

    private lastPingCheck: number = 0;

    private loop = (): void => {
        if (!this.running) return;

        g_dispatcher.poll();
        g_gameManager.update();

        const now = performance.now();
        if (now - this.lastPingCheck > 10000) {
            this.lastPingCheck = now;
        }

        requestAnimationFrame(this.loop);
    }
}

export const g_gameLoop = GameLoop.getInstance();
