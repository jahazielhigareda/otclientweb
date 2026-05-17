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
    private camera = { x: 0, y: 0, z: 0 };
    private virtualCenterOffset = { x: 0, y: 0 };
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
            const viewWidthTiles = Math.ceil(this.canvas.width / TILE_SIZE);
            const viewHeightTiles = Math.ceil(this.canvas.height / TILE_SIZE);
            const adjustedWidth = viewWidthTiles % 2 === 1 ? viewWidthTiles : viewWidthTiles + 1;
            const adjustedHeight = viewHeightTiles % 2 === 1 ? viewHeightTiles : viewHeightTiles + 1;
            this.virtualCenterOffset.x = ((adjustedWidth + 3) / 2 - 1);
            this.virtualCenterOffset.y = ((adjustedHeight + 3) / 2 - 1);
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
        return ((((((phase % item.animationPhases)
            * item.patternZ + pz)
            * item.patternY + py)
            * item.patternX + px)
            * item.layers + layer)
            * item.height + y)
            * item.width + x;
    }

    private isGround(item: DatItem): boolean {
        return !!(item.flags & (1n << BigInt(DatFlag.IsGround)));
    }

    private isGroundBorder(item: DatItem): boolean {
        return !!(item.flags & (1n << BigInt(DatFlag.IsGroundBorder)));
    }

    private isOnBottom(item: DatItem): boolean {
        return !!(item.flags & (1n << BigInt(DatFlag.IsOnBottom)));
    }

    private isOnTop(item: DatItem): boolean {
        return !!(item.flags & (1n << BigInt(DatFlag.IsOnTop)));
    }

    private isCommon(item: DatItem): boolean {
        return !this.isGround(item) && !this.isGroundBorder(item) && !this.isOnBottom(item) && !this.isOnTop(item);
    }

    private drawItem(item: DatItem, baseX: number, baseY: number, drawElevation: number, pz: number = 0): void {
        const { width, height, layers, animationPhases } = item;
        const phase = animationPhases > 1 ? Math.floor(this.animationTimer.ticksElapsed() / 500) % animationPhases : 0;

        const destX = baseX - drawElevation;
        const destY = baseY - drawElevation;

        const displacementX = (item.flags & (1n << BigInt(DatFlag.IsDisplacement))) ? item.offsetX : 0;
        const displacementY = (item.flags & (1n << BigInt(DatFlag.IsDisplacement))) ? item.offsetY : 0;

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
                        const finalX = destX + ox - displacementX;
                        const finalY = destY + oy - displacementY;
                        this.ctx!.drawImage(spriteCanvas,
                            Math.round(finalX),
                            Math.round(finalY));
                    }
                }
            }
        }
    }

    private drawOutfit(outfitItem: DatItem, baseX: number, baseY: number, drawElevation: number, creature: CreatureData): void {
        const { width, height, layers, patternX, animationPhases } = outfitItem;

        const destX = baseX - drawElevation;
        const displacementX = (outfitItem.flags & (1n << BigInt(DatFlag.IsDisplacement))) ? outfitItem.offsetX : 0;
        const displacementY = (outfitItem.flags & (1n << BigInt(DatFlag.IsDisplacement))) ? outfitItem.offsetY : 0;
        const destY = baseY - drawElevation;

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
                        const finalX = destX + ox - displacementX;
                        const finalY = destY + oy - displacementY;
                        this.ctx!.drawImage(spriteCanvas,
                            Math.round(finalX),
                            Math.round(finalY));
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

            const tileInfo = new Array(tiles.length);
            for (let i = 0; i < tiles.length; i++) {
                const tile = tiles[i];
                tileInfo[i] = {
                    tile,
                    coords: this.getScreenCoords(tile),
                    elevation: 0
                };
            }

            // Pass 1: Ground, Bottom and Common
            for (let i = 0; i < tileInfo.length; i++) {
                const info = tileInfo[i];
                const things = info.tile.things;
                let elevation = 0;

                // Ground & Bottom
                for (let j = 0; j < things.length; j++) {
                    const thing = things[j];
                    if (thing.type === 'item') {
                        const item = dat.getItem(thing.id);
                        if (item && (this.isGround(item) || this.isGroundBorder(item) || this.isOnBottom(item))) {
                            this.drawItem(item, info.coords.screenX, info.coords.screenY, elevation);
                            if (item.flags & (1n << 25n)) { // IsElevation
                                elevation = Math.min(elevation + item.elevation, 24);
                            }
                        }
                    }
                }

                // Common items in reverse order
                for (let j = things.length - 1; j >= 0; j--) {
                    const thing = things[j];
                    if (thing.type === 'item') {
                        const item = dat.getItem(thing.id);
                        if (item && this.isCommon(item)) {
                            this.drawItem(item, info.coords.screenX, info.coords.screenY, elevation);
                            if (item.flags & (1n << 25n)) { // IsElevation
                                elevation = Math.min(elevation + item.elevation, 24);
                            }
                        }
                    }
                }
                info.elevation = elevation;
            }

            // Pass 2: Creatures
            for (let i = 0; i < tileInfo.length; i++) {
                const info = tileInfo[i];
                const things = info.tile.things;
                for (let j = 0; j < things.length; j++) {
                    const thing = things[j];
                    if (thing.type === 'creature') {
                        const creature = g_gameMap.getCreature(thing.id);
                        if (creature && creature.outfit) {
                            const outfitItem = dat.getOutfit(creature.outfit.lookType);
                            if (outfitItem) {
                                this.drawOutfit(outfitItem, info.coords.screenX, info.coords.screenY, info.elevation, creature);
                            }
                            const cx = info.coords.screenX - info.elevation + TILE_SIZE / 2;
                            const cy = info.coords.screenY - info.elevation;
                            this.ctx!.fillStyle = '#ffffff';
                            this.ctx!.font = '10px sans-serif';
                            this.ctx!.textAlign = 'center';
                            this.ctx!.fillText(creature.name, cx, cy - 6);
                        }
                    }
                }
            }

            // Pass 3: Top Items
            for (let i = 0; i < tileInfo.length; i++) {
                const info = tileInfo[i];
                const things = info.tile.things;
                let topElevation = 0;
                for (let j = 0; j < things.length; j++) {
                    const thing = things[j];
                    if (thing.type === 'item') {
                        const item = dat.getItem(thing.id);
                        if (item && this.isOnTop(item)) {
                            this.drawItem(item, info.coords.screenX, info.coords.screenY, topElevation);
                            if (item.flags & (1n << 25n)) { // IsElevation
                                topElevation = Math.min(topElevation + item.elevation, 24);
                            }
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
