export interface DatItem {
    tibiaId: number;
    flags: bigint;
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

export const DatCategory = {
    Item: 0,
    Outfit: 1,
    Effect: 2,
    Missile: 3,
} as const;
export type DatCategory = typeof DatCategory[keyof typeof DatCategory];


export const DatFlag = {
    IsGround: 0,
    IsGroundBorder: 1,
    IsOnBottom: 2,
    IsOnTop: 3,
    IsContainer: 4,
    IsStackable: 5,
    IsForceUse: 6,
    IsMultiUse: 7,
    IsWritable: 8,
    IsWritableOnce: 9,
    IsFluidContainer: 10,
    IsSplash: 11,
    IsNotWalkable: 12,
    IsNotMoveable: 13,
    IsBlockProjectile: 14,
    IsNotPathable: 15,
    IsPickupable: 16,
    IsHangable: 17,
    IsHookSouth: 18,
    IsHookEast: 19,
    IsRotateable: 20,
    IsLight: 21,
    IsDontHide: 22,
    IsTranslucent: 23,
    IsDisplacement: 24,
    IsElevation: 25,
    IsLyingCorpse: 26,
    IsAnimateAlways: 27,
    IsMinimapColor: 28,
    IsLensHelp: 29,
    IsFullGround: 30,
    IsLook: 31,
    IsCloth: 32,
    IsMarket: 33,
    IsUsable: 34,
    IsWrapable: 35,
    IsUnwrapable: 36,
    IsTopEffect: 37,
} as const;
export type DatFlag = typeof DatFlag[keyof typeof DatFlag];


type ByteReader = { getUint8: (offset: number) => number; getUint16: (offset: number, littleEndian: boolean) => number; getUint32: (offset: number, littleEndian: boolean) => number };

export class DatFile {
    private signature: number;
    private items: DatItem[];
    private outfits: DatItem[];
    private effects: DatItem[];
    private missiles: DatItem[];
    private itemMap: Map<number, DatItem> = new Map();
    private outfitMap: Map<number, DatItem> = new Map();
    private effectMap: Map<number, DatItem> = new Map();
    private missileMap: Map<number, DatItem> = new Map();

    private constructor(signature: number, items: DatItem[], outfits: DatItem[], effects: DatItem[], missiles: DatItem[]) {
        this.signature = signature;
        this.items = items;
        this.outfits = outfits;
        this.effects = effects;
        this.missiles = missiles;
        items.forEach(it => this.itemMap.set(it.tibiaId, it));
        outfits.forEach(it => this.outfitMap.set(it.tibiaId, it));
        effects.forEach(it => this.effectMap.set(it.tibiaId, it));
        missiles.forEach(it => this.missileMap.set(it.tibiaId, it));
    }

    getSignature(): number { return this.signature; }
    getItems(): DatItem[] { return this.items; }
    getOutfits(): DatItem[] { return this.outfits; }
    getEffects(): DatItem[] { return this.effects; }
    getMissiles(): DatItem[] { return this.missiles; }

    getItem(tibiaId: number): DatItem | undefined {
        return this.itemMap.get(tibiaId);
    }

    getOutfit(tibiaId: number): DatItem | undefined {
        return this.outfitMap.get(tibiaId);
    }

    getEffect(tibiaId: number): DatItem | undefined {
        return this.effectMap.get(tibiaId);
    }

    getMissile(tibiaId: number): DatItem | undefined {
        return this.missileMap.get(tibiaId);
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

        const _makeReader = (): ByteReader => ({
            getUint8: (o: number) => dv.getUint8(offset + o),
            getUint16: (o: number, le: boolean) => dv.getUint16(offset + o, le),
            getUint32: (o: number, le: boolean) => dv.getUint32(offset + o, le),
        });

        const readItem = (tibiaId: number, _isOutfit: boolean): DatItem => {
            const item: DatItem = {
                tibiaId, flags: 0n, speed: 0, maxWriteChars: 0, maxReadChars: 0,
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
                    case 0: { item.flags |= (1n << BigInt(DatFlag.IsGround)); item.speed = dv.getUint16(offset, true); offset += 2; break; }
                    case 1: { item.flags |= (1n << BigInt(DatFlag.IsGroundBorder)); break; }
                    case 2: { item.flags |= (1n << BigInt(DatFlag.IsOnBottom)); break; }
                    case 3: { item.flags |= (1n << BigInt(DatFlag.IsOnTop)); break; }
                    case 4: { item.flags |= (1n << BigInt(DatFlag.IsContainer)); break; }
                    case 5: { item.flags |= (1n << BigInt(DatFlag.IsStackable)); break; }
                    case 6: { item.flags |= (1n << BigInt(DatFlag.IsForceUse)); break; }
                    case 7: { item.flags |= (1n << BigInt(DatFlag.IsMultiUse)); break; }
                    case 8: { item.flags |= (1n << BigInt(DatFlag.IsWritable)); item.maxWriteChars = dv.getUint16(offset, true); offset += 2; break; }
                    case 9: { item.flags |= (1n << BigInt(DatFlag.IsWritableOnce)); item.maxReadChars = dv.getUint16(offset, true); offset += 2; break; }
                    case 10: { item.flags |= (1n << BigInt(DatFlag.IsFluidContainer)); break; }
                    case 11: { item.flags |= (1n << BigInt(DatFlag.IsSplash)); break; }
                    case 12: { item.flags |= (1n << BigInt(DatFlag.IsNotWalkable)); break; }
                    case 13: { item.flags |= (1n << BigInt(DatFlag.IsNotMoveable)); break; }
                    case 14: { item.flags |= (1n << BigInt(DatFlag.IsBlockProjectile)); break; }
                    case 15: { item.flags |= (1n << BigInt(DatFlag.IsNotPathable)); break; }
                    case 16: { item.flags |= (1n << BigInt(DatFlag.IsPickupable)); break; }
                    case 17: { item.flags |= (1n << BigInt(DatFlag.IsHangable)); break; }
                    case 18: { item.flags |= (1n << BigInt(DatFlag.IsHookSouth)); break; }
                    case 19: { item.flags |= (1n << BigInt(DatFlag.IsHookEast)); break; }
                    case 20: { item.flags |= (1n << BigInt(DatFlag.IsRotateable)); break; }
                    case 21: {
                        item.flags |= (1n << BigInt(DatFlag.IsLight));
                        item.lightLevel = dv.getUint16(offset, true); offset += 2;
                        item.lightColor = dv.getUint16(offset, true); offset += 2;
                        break;
                    }
                    case 22: { item.flags |= (1n << BigInt(DatFlag.IsDontHide)); break; }
                    case 23: { item.flags |= (1n << BigInt(DatFlag.IsTranslucent)); break; }
                    case 24: {
                        item.flags |= (1n << BigInt(DatFlag.IsDisplacement));
                        item.offsetX = dv.getUint16(offset, true); offset += 2;
                        item.offsetY = dv.getUint16(offset, true); offset += 2;
                        break;
                    }
                    case 25: { item.flags |= (1n << BigInt(DatFlag.IsElevation)); item.elevation = dv.getUint16(offset, true); offset += 2; break; }
                    case 26: { item.flags |= (1n << BigInt(DatFlag.IsLyingCorpse)); break; }
                    case 27: { item.flags |= (1n << BigInt(DatFlag.IsAnimateAlways)); break; }
                    case 28: { item.flags |= (1n << BigInt(DatFlag.IsMinimapColor)); item.minimapColor = dv.getUint16(offset, true); offset += 2; break; }
                    case 29: { item.flags |= (1n << BigInt(DatFlag.IsLensHelp)); break; }
                    case 30: { item.flags |= (1n << BigInt(DatFlag.IsFullGround)); break; }
                    case 31: { item.flags |= (1n << BigInt(DatFlag.IsLook)); break; }
                    case 32: { item.flags |= (1n << BigInt(DatFlag.IsCloth)); item.cloth = dv.getUint16(offset, true); offset += 2; break; }
                    case 33: {
                        item.flags |= (1n << BigInt(DatFlag.IsMarket));
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
                    case 34: { item.flags |= (1n << BigInt(DatFlag.IsUsable)); break; }
                    case 35: { item.flags |= (1n << BigInt(DatFlag.IsWrapable)); break; }
                    case 36: { item.flags |= (1n << BigInt(DatFlag.IsUnwrapable)); break; }
                    case 37: { item.flags |= (1n << BigInt(DatFlag.IsTopEffect)); break; }
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
