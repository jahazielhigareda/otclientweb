import { g_gameManager } from './GameManager';
import { g_gameMap } from './GameMap';
import { g_resourceLoader } from './ResourceLoader';
import type { CreatureData } from './GameMap';
import type { DatItem } from './DatFile';

const TILE_SIZE = 32;

export class GameRenderer {
    private static instance: GameRenderer;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private camera = { x: 0, y: 0 };
    private spriteCanvasCache: Map<number, HTMLCanvasElement> = new Map();

    private constructor() {}

    public static getInstance(): GameRenderer {
        if (!GameRenderer.instance) {
            GameRenderer.instance = new GameRenderer();
        }
        return GameRenderer.instance;
    }

    init(canvasId: string): void {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    }

    private getSpriteCanvas(spriteId: number): HTMLCanvasElement | null {
        if (this.spriteCanvasCache.has(spriteId)) {
            return this.spriteCanvasCache.get(spriteId)!;
        }
        const spr = g_resourceLoader.getSprites();
        if (!spr) return null;
        const imgData = spr.getSprite(spriteId);
        if (!imgData) return null;
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(imgData, 0, 0);
        this.spriteCanvasCache.set(spriteId, canvas);
        return canvas;
    }

    private spriteIndex(item: DatItem, x: number, y: number, layer: number, px: number, py: number, pz: number, phase: number): number {
        const { width, height, layers, patternX, patternY, patternZ } = item;
        const stridePx = layers * height * width;
        const stridePy = patternX * stridePx;
        const stridePz = patternY * stridePy;

        return phase * patternZ * stridePz
            + pz * stridePz
            + py * stridePy
            + px * stridePx
            + layer * height * width
            + y * width
            + x;
    }

    private drawItem(item: DatItem, baseX: number, baseY: number): void {
        const { width, height, layers, patternX, spriteIds } = item;
        const adjustY = baseY - (height - 1) * TILE_SIZE;

        for (let layer = 0; layer < layers; layer++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = this.spriteIndex(item, x, y, layer, 0, 0, 0, 0);
                    const sid = spriteIds[idx];
                    if (!sid) continue;
                    const spriteCanvas = this.getSpriteCanvas(sid);
                    if (spriteCanvas) {
                        this.ctx!.drawImage(spriteCanvas,
                            Math.round(baseX + x * TILE_SIZE),
                            Math.round(adjustY + y * TILE_SIZE));
                    }
                }
            }
        }
    }

    private drawOutfit(outfitItem: DatItem, baseX: number, baseY: number, creature: CreatureData): void {
        const { width, height, layers, patternX } = outfitItem;

        let dirPx = 0;
        switch (creature.direction) {
            case 1: dirPx = 1; break;
            case 2: dirPx = 2; break;
            case 3: dirPx = 0; break;
        }
        if (dirPx >= patternX) dirPx = 0;

        const py = creature.outfit && creature.outfit.addons > 0 ? 1 : 0;
        const adjustY = baseY - (height - 1) * TILE_SIZE;

        for (let layer = 0; layer < layers; layer++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = this.spriteIndex(outfitItem, x, y, layer, dirPx, py, 0, 0);
                    const sid = outfitItem.spriteIds[idx];
                    if (!sid) continue;
                    const spriteCanvas = this.getSpriteCanvas(sid);
                    if (spriteCanvas) {
                        this.ctx!.drawImage(spriteCanvas,
                            Math.round(baseX + x * TILE_SIZE),
                            Math.round(adjustY + y * TILE_SIZE));
                    }
                }
            }
        }
    }

    render(): void {
        if (!this.ctx || !this.canvas) return;

        const player = g_gameManager.player;
        const dat = g_resourceLoader.getDat();

        this.camera.x = player.x * TILE_SIZE - this.canvas.width / 2;
        this.camera.y = player.y * TILE_SIZE - this.canvas.height / 2;

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const viewWidth = Math.ceil(this.canvas.width / TILE_SIZE) + 2;
        const viewHeight = Math.ceil(this.canvas.height / TILE_SIZE) + 2;

        const tiles = g_gameMap.getTilesInViewport(player.x, player.y, player.z, viewWidth, viewHeight);
        tiles.sort((a, b) => a.position.y - b.position.y);

        for (const tile of tiles) {
            const screenX = (tile.position.x * TILE_SIZE) - this.camera.x;
            const screenY = (tile.position.y * TILE_SIZE) - this.camera.y;

            if (tile.groundId && dat) {
                const item = dat.getItem(tile.groundId);
                if (item) {
                    this.drawItem(item, screenX, screenY);
                    // Minimap color overlay (RGB565 → rgba)
                    if (item.minimapColor > 0) {
                        const mc = item.minimapColor;
                        const mr = ((mc >> 11) & 0x1F) / 31;
                        const mg = ((mc >> 5) & 0x3F) / 63;
                        const mb = (mc & 0x1F) / 31;
                        this.ctx!.fillStyle = `rgba(${Math.round(mr * 255)},${Math.round(mg * 255)},${Math.round(mb * 255)},0.25)`;
                        this.ctx!.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                    }
                } else {
                    this.ctx.fillStyle = '#2a3a1a';
                    this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                }
            } else {
                this.ctx.fillStyle = '#1a1a1a';
                this.ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            }
            this.ctx.strokeStyle = '#2a2a2a';
            this.ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

            // Render stacked items (non-ground) on top of ground
            if (tile.itemIds && dat) {
                for (const itemId of tile.itemIds) {
                    const stackItem = dat.getItem(itemId);
                    if (stackItem) {
                        this.drawItem(stackItem, screenX, screenY);
                    }
                }
            }
        }

        const creatures = g_gameMap.getAllCreatures();
        creatures.sort((a, b) => a.position.y - b.position.y);

        for (const creature of creatures) {
            const screenX = (creature.position.x * TILE_SIZE) - this.camera.x;
            const screenY = (creature.position.y * TILE_SIZE) - this.camera.y;

            if (creature.outfit && creature.outfit.lookType && dat) {
                const outfitItem = dat.getOutfit(creature.outfit.lookType);
                if (outfitItem) {
                    this.drawOutfit(outfitItem, screenX, screenY, creature);
                }
            }

            const cx = screenX + TILE_SIZE / 2;
            const cy = screenY + TILE_SIZE / 2;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(creature.name, cx, screenY - 6);
        }
    }
}

export const g_gameRenderer = GameRenderer.getInstance();
