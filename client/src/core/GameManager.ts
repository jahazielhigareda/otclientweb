import { g_gameRenderer } from './GameRenderer';
import { g_gameLoop } from './GameLoop';
import { g_networkManager } from '../network/NetworkManager';
import { ProtocolGame } from '../network/protocols/ProtocolGame';

export interface PlayerState {
    id: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    level: number;
    experience: number;
    capacity: number;
    soul: number;
    stamina: number;
    magicLevel: number;
}

export class GameManager {
    private static instance: GameManager;
    public player: PlayerState = {
        id: 0,
        x: 0,
        y: 0,
        z: 7,
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
        level: 1,
        experience: 0,
        capacity: 400,
        soul: 100,
        stamina: 2520,
        magicLevel: 0,
    };

    private constructor() {}

    public static getInstance(): GameManager {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }

    init(canvas: HTMLCanvasElement): void {
        g_gameRenderer.init(canvas);
        window.addEventListener('keydown', (e) => this.handleInput(e));
        window.addEventListener('map_loaded', () => {
            console.log('[GameManager] Map loaded, starting game loop');
            g_gameLoop.start();
        });
    }

    private handleInput(e: KeyboardEvent): void {
        const proto = g_networkManager.getCurrentProtocol();
        if (!(proto instanceof ProtocolGame)) return;

        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup':    proto.sendWalkNorth(); break;
            case 's': case 'arrowdown':  proto.sendWalkSouth(); break;
            case 'a': case 'arrowleft':  proto.sendWalkWest(); break;
            case 'd': case 'arrowright': proto.sendWalkEast(); break;
        }
    }

    updatePlayer(data: Partial<PlayerState>): void {
        Object.assign(this.player, data);
    }

    setPosition(x: number, y: number, z: number): void {
        this.player.x = x;
        this.player.y = y;
        this.player.z = z;
    }

    update(): void {
        g_gameRenderer.render();
    }
}

export const g_gameManager = GameManager.getInstance();
