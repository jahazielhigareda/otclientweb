import { g_gameManager } from './GameManager';
import { g_gameMap } from './GameMap';
import { g_resourceLoader } from './ResourceLoader';
import type { CreatureData, TileData } from './GameMap';
import { type DatItem, DatFlag } from './DatFile';
import { Timer } from './Timer';

const TILE_SIZE = 32;

export class GameRenderer {
    private animationTimer = new Timer();
    private static instance: GameRenderer;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private camera = { x: 0, y: 0, z: 0 }; // Camera position in tile coordinates
    private virtualCenterOffset = { x: 0, y: 0 }; // In tile units
    private spriteCanvasCache: Map<number, HTMLCanvasElement> = new Map();

    private constructor() {}

    public static getInstance(): GameRenderer {
        if (!GameRenderer.instance) {
            GameRenderer.instance = new GameRenderer();
        }
        return GameRenderer.instance;
    }

    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        if (this.canvas) {
            console.log('[GameRenderer] Canvas initialized via reference');
            this.ctx = this.canvas.getContext('2d');
            this.updateCanvasSize();
            window.addEventListener('resize', () => this.updateCanvasSize());
        }
    }

    private updateCanvasSize(): void {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateVirtualCenterOffset();
        }
    }

    private updateVirtualCenterOffset(): void {
        if (this.canvas) {
            // Calculate how many tiles fit in the canvas
            const viewWidthTiles = Math.ceil(this.canvas.width / TILE_SIZE);
            const viewHeightTiles = Math.ceil(this.canvas.height / TILE_SIZE);

            // Ensure dimensions are odd (required for proper centering)
            const adjustedWidth = viewWidthTiles % 2 === 1 ? viewWidthTiles : viewWidthTiles + 1;
            const adjustedHeight = viewHeightTiles % 2 === 1 ? viewHeightTiles : viewHeightTiles + 1;

            // OTClient: m_virtualCenterOffset = (drawDimension / 2 - Size(1)).toPoint();
            // where drawDimension = visibleDimension + 3
            this.virtualCenterOffset.x = ((adjustedWidth + 3) / 2 - 1);
            this.virtualCenterOffset.y = ((adjustedHeight + 3) / 2 - 1);
        }
    }

    private getSpriteCanvas(spriteId: number): HTMLCanvasElement | null {
        if (this.spriteCanvasCache.has(spriteId)) {
            return this.spriteCanvasCache.get(spriteId)!;
        }
        const spr = g_resourceLoader.getSprites();
        if (!spr) {
            // console.error('[GameRenderer] SpritesFile not loaded!');
            return null;
        }
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
        return ((((((phase % item.animationPhases)
            * item.patternZ + pz)
            * item.patternY + py)
            * item.patternX + px)
            * item.layers + layer)
            * item.height + y)
            * item.width + x;
    }

    private drawItem(item: DatItem, baseX: number, baseY: number, pz: number = 0): void {
        const { width, height, layers, animationPhases } = item;
        const phase = animationPhases > 1 ? Math.floor(this.animationTimer.ticksElapsed() / 500) % animationPhases : 0;

        const displacementX = item.offsetX;
        const displacementY = item.offsetY;

        for (let layer = 0; layer < layers; layer++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = this.spriteIndex(item, x, y, layer, 0, 0, pz, phase);
                    const sid = item.spriteIds[idx];
                    if (!sid) continue;

                    const spriteCanvas = this.getSpriteCanvas(sid);
                    if (spriteCanvas) {
                        const ox = (x - (width - 1)) * TILE_SIZE;
                        const oy = (y - (height - 1)) * TILE_SIZE;
                        this.ctx!.drawImage(spriteCanvas,
                            Math.round(baseX + ox - displacementX),
                            Math.round(baseY + oy - displacementY));
                    }
                }
            }
        }
    }

    private drawOutfit(outfitItem: DatItem, baseX: number, baseY: number, creature: CreatureData): void {
        const { width, height, layers, patternX, animationPhases } = outfitItem;

        // Tibia direction order: 0: North, 1: East, 2: South, 3: West
        // Dat patternX order: 0: North, 1: East, 2: South, 3: West
        let dirPx = creature.direction % patternX;

        const phase = animationPhases > 1 ? Math.floor(this.animationTimer.ticksElapsed() / 500) % animationPhases : 0;

        for (let layer = 0; layer < layers; layer++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = this.spriteIndex(outfitItem, x, y, layer, dirPx, 0, 0, phase);
                    const sid = outfitItem.spriteIds[idx];
                    if (!sid) continue;
                    const spriteCanvas = this.getSpriteCanvas(sid);
                    if (spriteCanvas) {
                        const ox = (x - (width - 1)) * TILE_SIZE;
                        const oy = (y - (height - 1)) * TILE_SIZE;
                        this.ctx!.drawImage(spriteCanvas,
                            Math.round(baseX + ox - outfitItem.offsetX),
                            Math.round(baseY + oy - outfitItem.offsetY));
                    }
                }
            }
        }
    }

    render(): void {
        if (!this.ctx || !this.canvas) return;

        const player = g_gameManager.player;
        const dat = g_resourceLoader.getDat();
        if (!dat) return;

        this.updateVirtualCenterOffset();
        this.camera.x = player.x;
        this.camera.y = player.y;
        this.camera.z = player.z;

        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const SEA_FLOOR = 7;
        const SURFACE_VIEW_RANGE = 7;
        const UNDERGROUND_VIEW_RANGE = 2;

        let minZ, maxZ;
        if (player.z <= SEA_FLOOR) {
            minZ = Math.max(0, player.z - SURFACE_VIEW_RANGE);
            maxZ = SEA_FLOOR;
        } else {
            minZ = player.z - UNDERGROUND_VIEW_RANGE;
            maxZ = Math.min(15, player.z + UNDERGROUND_VIEW_RANGE);
        }

        for (let z = maxZ; z >= minZ; z--) {
            const viewWidth = Math.ceil(this.canvas.width / TILE_SIZE) + 6;
            const viewHeight = Math.ceil(this.canvas.height / TILE_SIZE) + 6;

            const zOffset = z - player.z;
            const centerX = player.x + zOffset;
            const centerY = player.y + zOffset;

            const tiles = g_gameMap.getTilesInViewport(centerX, centerY, z, viewWidth, viewHeight);
            if (tiles.length === 0) continue;

            tiles.sort((a, b) => {
                if (a.position.y !== b.position.y) return a.position.y - b.position.y;
                return a.position.x - b.position.x;
            });

            // Pass 1: Ground
            for (const tile of tiles) {
                const { screenX, screenY } = this.getScreenCoords(tile);
                for (const thing of tile.things) {
                    if (thing.type === 'item') {
                        const item = dat.getItem(thing.id);
                        if (item && (item.flags & (1n << BigInt(DatFlag.IsGround)))) {
                            this.drawItem(item, screenX, screenY);
                        }
                    }
                }
            }

            // Pass 2: Bottom items
            for (const tile of tiles) {
                const { screenX, screenY } = this.getScreenCoords(tile);
                for (const thing of tile.things) {
                    if (thing.type === 'item') {
                        const item = dat.getItem(thing.id);
                        if (item && (item.flags & ((1n << BigInt(DatFlag.IsOnBottom)) | (1n << BigInt(DatFlag.IsGroundBorder))))) {
                            this.drawItem(item, screenX, screenY);
                        }
                    }
                }
            }

            // Pass 3: Common items and Creatures
            for (const tile of tiles) {
                const { screenX, screenY } = this.getScreenCoords(tile);
                let elevation = 0;

                for (const thing of tile.things) {
                    if (thing.type === 'item') {
                        const item = dat.getItem(thing.id);
                        if (!item) continue;

                        const flags = item.flags;
                        const isGround = flags & (1n << BigInt(DatFlag.IsGround));
                        const isBottom = flags & ((1n << BigInt(DatFlag.IsOnBottom)) | (1n << BigInt(DatFlag.IsGroundBorder)));
                        const isOnTop = flags & (1n << BigInt(DatFlag.IsOnTop));

                        if (!isGround && !isBottom && !isOnTop) {
                            this.drawItem(item, screenX - elevation, screenY - elevation);
                            elevation += item.elevation;
                        } else if (isGround || isBottom) {
                            elevation += item.elevation;
                        }
                    } else if (thing.type === 'creature') {
                        const creature = g_gameMap.getCreature(thing.id);
                        if (creature && creature.outfit) {
                            const outfitItem = dat.getOutfit(creature.outfit.lookType);
                            if (outfitItem) {
                                this.drawOutfit(outfitItem, screenX - elevation, screenY - elevation, creature);
                            }
                            // Draw name
                            const cx = screenX - elevation + TILE_SIZE / 2;
                            this.ctx.fillStyle = '#ffffff';
                            this.ctx.font = '10px sans-serif';
                            this.ctx.textAlign = 'center';
                            this.ctx.fillText(creature.name, cx, screenY - elevation - 6);
                        }
                    }
                }
            }

            // Pass 4: Top items
            for (const tile of tiles) {
                const { screenX, screenY } = this.getScreenCoords(tile);
                for (const thing of tile.things) {
                    if (thing.type === 'item') {
                        const item = dat.getItem(thing.id);
                        if (item && (item.flags & (1n << BigInt(DatFlag.IsOnTop)))) {
                            this.drawItem(item, screenX, screenY);
                        }
                    }
                }
            }
        }
    }

    private getScreenCoords(tile: TileData): { screenX: number; screenY: number } {
        const screenX = (this.virtualCenterOffset.x + (tile.position.x - this.camera.x) - (this.camera.z - tile.position.z)) * TILE_SIZE;
        const screenY = (this.virtualCenterOffset.y + (tile.position.y - this.camera.y) - (this.camera.z - tile.position.z)) * TILE_SIZE;
        return { screenX, screenY };
    }
}

export const g_gameRenderer = GameRenderer.getInstance();