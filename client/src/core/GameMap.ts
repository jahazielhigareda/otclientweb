import type { TilePosition } from '../network/types';

export interface TileData {
    position: TilePosition;
    groundId?: number;
    creatureId?: number;
    creatureName?: string;
    creatureHealthPercent?: number;
    minimapColor?: number;
    itemIds?: number[];
}

export interface CreatureData {
    id: number;
    name: string;
    position: TilePosition;
    healthPercent: number;
    direction: number;
    speed: number;
    outfit?: {
        lookType: number;
        head: number;
        body: number;
        legs: number;
        feet: number;
        addons: number;
    };
}

export class GameMap {
    private static instance: GameMap;
    private tiles: Map<string, TileData>;
    private creatures: Map<number, CreatureData>;

    private constructor() {
        this.tiles = new Map();
        this.creatures = new Map();
    }

    static getInstance(): GameMap {
        if (!GameMap.instance) {
            GameMap.instance = new GameMap();
        }
        return GameMap.instance;
    }

    setTile(x: number, y: number, z: number, data: Partial<TileData>): void {
        const key = this.key(x, y, z);
        const existing = this.tiles.get(key) || { position: { x, y, z } };
        Object.assign(existing, data);
        existing.position = { x, y, z };
        this.tiles.set(key, existing);
    }

    getTile(x: number, y: number, z: number): TileData | undefined {
        return this.tiles.get(this.key(x, y, z));
    }

    removeTile(x: number, y: number, z: number): void {
        this.tiles.delete(this.key(x, y, z));
    }

    hasTile(x: number, y: number, z: number): boolean {
        return this.tiles.has(this.key(x, y, z));
    }

    addCreature(id: number, name: string, x: number, y: number, z: number, healthPercent: number, direction: number, outfit?: { lookType: number; head: number; body: number; legs: number; feet: number; addons: number }): void {
        this.creatures.set(id, {
            id,
            name,
            position: { x, y, z },
            healthPercent,
            direction,
            speed: 0,
            outfit,
        });
        this.setTile(x, y, z, { creatureId: id, creatureName: name, creatureHealthPercent: healthPercent });
    }

    updateCreatureOutfit(id: number, lookType: number, head: number, body: number, legs: number, feet: number, addons: number): void {
        const creature = this.creatures.get(id);
        if (creature) {
            creature.outfit = { lookType, head, body, legs, feet, addons };
        }
    }

    removeCreature(id: number): void {
        const creature = this.creatures.get(id);
        if (creature) {
            const { x, y, z } = creature.position;
            const tile = this.getTile(x, y, z);
            if (tile && tile.creatureId === id) {
                tile.creatureId = undefined;
                tile.creatureName = undefined;
                tile.creatureHealthPercent = undefined;
            }
        }
        this.creatures.delete(id);
    }

    moveCreature(id: number, fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number): void {
        const creature = this.creatures.get(id);
        if (creature) {
            const oldTile = this.getTile(fromX, fromY, fromZ);
            if (oldTile && oldTile.creatureId === id) {
                oldTile.creatureId = undefined;
                oldTile.creatureName = undefined;
                oldTile.creatureHealthPercent = undefined;
            }
            creature.position = { x: toX, y: toY, z: toZ };
            this.setTile(toX, toY, toZ, {
                creatureId: id,
                creatureName: creature.name,
                creatureHealthPercent: creature.healthPercent,
            });
        } else {
            this.setTile(toX, toY, toZ, { creatureId: id });
        }
    }

    updateCreatureHealth(id: number, healthPercent: number): void {
        const creature = this.creatures.get(id);
        if (creature) {
            creature.healthPercent = healthPercent;
            const { x, y, z } = creature.position;
            const tile = this.getTile(x, y, z);
            if (tile) tile.creatureHealthPercent = healthPercent;
        }
    }

    getCreature(id: number): CreatureData | undefined {
        return this.creatures.get(id);
    }

    getAllCreatures(): CreatureData[] {
        return Array.from(this.creatures.values());
    }

    getTilesInViewport(centerX: number, centerY: number, centerZ: number, width: number, height: number): TileData[] {
        const result: TileData[] = [];
        const halfW = Math.floor(width / 2);
        const halfH = Math.floor(height / 2);
        for (let dx = -halfW; dx <= halfW; dx++) {
            for (let dy = -halfH; dy <= halfH; dy++) {
                const tile = this.getTile(centerX + dx, centerY + dy, centerZ);
                if (tile) result.push(tile);
            }
        }
        return result;
    }

    tileCount(): number {
        return this.tiles.size;
    }

    clear(): void {
        this.tiles.clear();
        this.creatures.clear();
    }

    private key(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }
}

export const g_gameMap = GameMap.getInstance();
