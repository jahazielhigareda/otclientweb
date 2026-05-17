export interface DatItem {
    tibiaId: number;
    flags: number;
    speed: number;
    maxWriteChars: number;
    maxReadChars: number;
    lightLevel: number;
    lightColor: number;
    offsetX: number;
    offsetY: number;
    elevation: number;
    minimapColor: number;
    cloth: number;
    category: number;
    tradeAs: number;
    showAs: number;
    name: string;
    restrictVocation: number;
    requiredLevel: number;
    width: number;
    height: number;
    cropSize: number;
    layers: number;
    patternX: number;
    patternY: number;
    patternZ: number;
    animationPhases: number;
    spriteIds: number[];
}

export enum DatCategory {
    Item = 0,
    Outfit = 1,
    Effect = 2,
    Missile = 3,
}

const FLAG_GROUND = 1 << 0;
const FLAG_GROUND_BORDER = 1 << 1;
const FLAG_ON_BOTTOM = 1 << 2;
const FLAG_ON_TOP = 1 << 3;
const FLAG_CONTAINER = 1 << 4;
const FLAG_STACKABLE = 1 << 5;
const FLAG_FORCE_USE = 1 << 6;
const FLAG_MULTI_USE = 1 << 7;
const FLAG_WRITABLE = 1 << 8;
const FLAG_WRITABLE_ONCE = 1 << 10;
const FLAG_FLUID_CONTAINER = 1 << 11;
const FLAG_SPLASH = 1 << 12;
const FLAG_NOT_WALKABLE = 1 << 13;
const FLAG_NOT_MOVEABLE = 1 << 14;
const FLAG_BLOCK_PROJECTILE = 1 << 15;
const FLAG_NOT_PATHABLE = 1 << 16;
const FLAG_PICKUPABLE = 1 << 17;
const FLAG_HANGABLE = 1 << 18;
const FLAG_HOOK_SOUTH = 1 << 19;
const FLAG_HOOK_EAST = 1 << 20;
const FLAG_ROTATEABLE = 1 << 21;
const FLAG_LIGHT = 1 << 22;
const FLAG_DONT_HIDE = 1 << 23;
const FLAG_TRANSLUCENT = 1 << 24;
const FLAG_DISPLACEMENT = 1 << 25;
const FLAG_ELEVATION = 1 << 26;
const FLAG_LYING_CORPSE = 1 << 27;
const FLAG_ANIMATE_ALWAYS = 1 << 28;
const FLAG_MINIMAP_COLOR = 1 << 29;
const FLAG_LENS_HELP = 1 << 30;
const FLAG_FULL_GROUND = 1 << 31;
const FLAG_LOOK = 1 << 32;
const FLAG_CLOTH = 1 << 33;
const FLAG_MARKET = 1 << 34;
const FLAG_USABLE = 1 << 35;
const FLAG_WRAPABLE = 1 << 36;
const FLAG_UNWRAPABLE = 1 << 37;
const FLAG_TOP_EFFECT = 1 << 43;
const FLAG_AMMO = 1 << 47;
const FLAG_FLOOR_CHANGE = 1 << 48;
const FLAG_DUAL_WIELD = 1 << 49;

type ByteReader = { getUint8: (offset: number) => number; getUint16: (offset: number, littleEndian: boolean) => number; getUint32: (offset: number, littleEndian: boolean) => number };

export class DatFile {
    private signature: number;
    private items: DatItem[];
    private outfits: DatItem[];
    private effects: DatItem[];
    private missiles: DatItem[];

    private constructor(signature: number, items: DatItem[], outfits: DatItem[], effects: DatItem[], missiles: DatItem[]) {
        this.signature = signature;
        this.items = items;
        this.outfits = outfits;
        this.effects = effects;
        this.missiles = missiles;
    }

    getSignature(): number { return this.signature; }
    getItems(): DatItem[] { return this.items; }
    getOutfits(): DatItem[] { return this.outfits; }
    getEffects(): DatItem[] { return this.effects; }
    getMissiles(): DatItem[] { return this.missiles; }

    getItem(tibiaId: number): DatItem | undefined {
        return this.items.find(it => it.tibiaId === tibiaId);
    }

    getOutfit(tibiaId: number): DatItem | undefined {
        return this.outfits.find(it => it.tibiaId === tibiaId);
    }

    getEffect(tibiaId: number): DatItem | undefined {
        return this.effects.find(it => it.tibiaId === tibiaId);
    }

    getMissile(tibiaId: number): DatItem | undefined {
        return this.missiles.find(it => it.tibiaId === tibiaId);
    }

    static loadFromBuffer(buffer: ArrayBuffer, clientVersion: number = 860): DatFile {
        const dv = new DataView(buffer);
        let offset = 0;

        const signature = dv.getUint32(offset, true); offset += 4;
        const spriteU32 = clientVersion >= 960;
        const idleAnim = clientVersion >= 1057;
        const enhancedAnim = clientVersion >= 1050;

        const itemCount = dv.getUint16(offset, true); offset += 2;
        const outfitCount = dv.getUint16(offset, true); offset += 2;
        const effectCount = dv.getUint16(offset, true); offset += 2;
        const missileCount = dv.getUint16(offset, true); offset += 2;

        const makeReader = (): ByteReader => ({
            getUint8: (o: number) => dv.getUint8(offset + o),
            getUint16: (o: number, le: boolean) => dv.getUint16(offset + o, le),
            getUint32: (o: number, le: boolean) => dv.getUint32(offset + o, le),
        });

        const readItem = (tibiaId: number, isOutfit: boolean): DatItem => {
            const item: DatItem = {
                tibiaId, flags: 0, speed: 0, maxWriteChars: 0, maxReadChars: 0,
                lightLevel: 0, lightColor: 0, offsetX: 0, offsetY: 0, elevation: 0,
                minimapColor: 0, cloth: 0, category: 0, tradeAs: 0, showAs: 0,
                name: '', restrictVocation: 0, requiredLevel: 0,
                width: 1, height: 1, cropSize: 0, layers: 1,
                patternX: 1, patternY: 1, patternZ: 1, animationPhases: 1,
                spriteIds: [],
            };

            while (true) {
                const attr = dv.getUint8(offset++);

                switch (attr) {
                    case 0: { item.flags |= FLAG_GROUND; item.speed = dv.getUint16(offset, true); offset += 2; break; }
                    case 1: { item.flags |= FLAG_GROUND_BORDER; break; }
                    case 2: { item.flags |= FLAG_ON_BOTTOM; break; }
                    case 3: { item.flags |= FLAG_ON_TOP; break; }
                    case 4: { item.flags |= FLAG_CONTAINER; break; }
                    case 5: { item.flags |= FLAG_STACKABLE; break; }
                    case 6: { item.flags |= FLAG_FORCE_USE; break; }
                    case 7: { item.flags |= FLAG_MULTI_USE; break; }
                    case 8: { item.flags |= FLAG_WRITABLE; item.maxWriteChars = dv.getUint16(offset, true); offset += 2; break; }
                    case 9: { item.flags |= FLAG_WRITABLE_ONCE; item.maxReadChars = dv.getUint16(offset, true); offset += 2; break; }
                    case 10: { item.flags |= FLAG_FLUID_CONTAINER; break; }
                    case 11: { item.flags |= FLAG_SPLASH; break; }
                    case 12: { item.flags |= FLAG_NOT_WALKABLE; break; }
                    case 13: { item.flags |= FLAG_NOT_MOVEABLE; break; }
                    case 14: { item.flags |= FLAG_BLOCK_PROJECTILE; break; }
                    case 15: { item.flags |= FLAG_NOT_PATHABLE; break; }
                    case 16: { item.flags |= FLAG_PICKUPABLE; break; }
                    case 17: { item.flags |= FLAG_HANGABLE; break; }
                    case 18: { item.flags |= FLAG_HOOK_SOUTH; break; }
                    case 19: { item.flags |= FLAG_HOOK_EAST; break; }
                    case 20: { item.flags |= FLAG_ROTATEABLE; break; }
                    case 21: {
                        item.flags |= FLAG_LIGHT;
                        item.lightLevel = dv.getUint16(offset, true); offset += 2;
                        item.lightColor = dv.getUint16(offset, true); offset += 2;
                        break;
                    }
                    case 22: { item.flags |= FLAG_DONT_HIDE; break; }
                    case 23: { item.flags |= FLAG_TRANSLUCENT; break; }
                    case 24: {
                        item.flags |= FLAG_DISPLACEMENT;
                        item.offsetX = dv.getUint16(offset, true); offset += 2;
                        item.offsetY = dv.getUint16(offset, true); offset += 2;
                        break;
                    }
                    case 25: { item.flags |= FLAG_ELEVATION; item.elevation = dv.getUint16(offset, true); offset += 2; break; }
                    case 26: { item.flags |= FLAG_LYING_CORPSE; break; }
                    case 27: { item.flags |= FLAG_ANIMATE_ALWAYS; break; }
                    case 28: { item.flags |= FLAG_MINIMAP_COLOR; item.minimapColor = dv.getUint16(offset, true); offset += 2; break; }
                    case 29: { item.flags |= FLAG_LENS_HELP; break; }
                    case 30: { item.flags |= FLAG_FULL_GROUND; break; }
                    case 31: { item.flags |= FLAG_LOOK; break; }
                    case 32: { item.flags |= FLAG_CLOTH; item.cloth = dv.getUint16(offset, true); offset += 2; break; }
                    case 33: {
                        item.flags |= FLAG_MARKET;
                        item.category = dv.getUint16(offset, true); offset += 2;
                        item.tradeAs = dv.getUint16(offset, true); offset += 2;
                        item.showAs = dv.getUint16(offset, true); offset += 2;
                        const nameLen = dv.getUint16(offset, true); offset += 2;
                        const nameBytes = new Uint8Array(buffer, offset, nameLen);
                        item.name = new TextDecoder('iso-8859-1').decode(nameBytes);
                        offset += nameLen;
                        item.restrictVocation = dv.getUint16(offset, true); offset += 2;
                        item.requiredLevel = dv.getUint16(offset, true); offset += 2;
                        break;
                    }
                    case 34: { item.flags |= FLAG_USABLE; break; }
                    case 35: { item.flags |= FLAG_WRAPABLE; break; }
                    case 36: { item.flags |= FLAG_UNWRAPABLE; break; }
                    case 37: { item.flags |= FLAG_TOP_EFFECT; break; }
                    case 255: {
                        const groupCount = idleAnim ? dv.getUint8(offset++) : 1;
                        for (let g = 0; g < groupCount; g++) {
                            if (idleAnim) offset++;
                            item.width = dv.getUint8(offset++);
                            item.height = dv.getUint8(offset++);
                            if (item.width > 1 || item.height > 1) {
                                item.cropSize = dv.getUint8(offset++);
                            }
                            item.layers = dv.getUint8(offset++);
                            item.patternX = dv.getUint8(offset++);
                            item.patternY = dv.getUint8(offset++);
                            item.patternZ = dv.getUint8(offset++);
                            item.animationPhases = dv.getUint8(offset++);

                            if (enhancedAnim && item.animationPhases > 1) {
                                offset++; offset += 4; offset++;
                                for (let a = 0; a < item.animationPhases; a++) {
                                    offset += 8;
                                }
                            }

                            const spriteCount = item.width * item.height * item.layers * item.patternX * item.patternY * item.patternZ * item.animationPhases;
                            // console.log(`[DatFile] Item ${tibiaId} spriteCount: ${spriteCount}`);
                            for (let s = 0; s < spriteCount; s++) {
                                if (spriteU32) {
                                    item.spriteIds.push(dv.getUint32(offset, true)); offset += 4;
                                } else {
                                    item.spriteIds.push(dv.getUint16(offset, true)); offset += 2;
                                }
                            }
                        }
                        return item;
                    }
                    default:
                        break;
                }
            }
        };

        const items: DatItem[] = [];
        for (let id = 100; id <= itemCount; id++) {
            items.push(readItem(id, false));
        }

        const outfits: DatItem[] = [];
        for (let id = 1; id <= outfitCount; id++) {
            outfits.push(readItem(id, true));
        }

        const effects: DatItem[] = [];
        for (let id = 1; id <= effectCount; id++) {
            effects.push(readItem(id, false));
        }

        const missiles: DatItem[] = [];
        for (let id = 1; id <= missileCount; id++) {
            missiles.push(readItem(id, false));
        }

        return new DatFile(signature, items, outfits, effects, missiles);
    }

    static async load(url: string, clientVersion: number = 860): Promise<DatFile> {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return DatFile.loadFromBuffer(buffer, clientVersion);
    }
}
