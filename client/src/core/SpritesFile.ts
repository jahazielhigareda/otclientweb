export class SpritesFile {
    private buffer: ArrayBuffer;
    private dataView: DataView;
    private spriteCount: number;
    private addresses: Uint32Array;
    private cache: (ImageData | null)[];

    private constructor(buffer: ArrayBuffer, spriteCount: number, addresses: Uint32Array) {
        this.buffer = buffer;
        this.dataView = new DataView(buffer);
        this.spriteCount = spriteCount;
        this.addresses = addresses;
        this.cache = new Array(spriteCount + 1).fill(null);
    }

    get count(): number {
        return this.spriteCount;
    }

    getSprite(id: number): ImageData | null {
        if (id < 1 || id > this.spriteCount) return null;
        if (this.cache[id]) return this.cache[id]!;

        const address = this.addresses[id - 1];
        if (address === 0) {
            this.cache[id] = null;
            return null;
        }

        const sprite = this.decodeSprite(address);
        this.cache[id] = sprite;
        return sprite;
    }

    private decodeSprite(address: number): ImageData {
        const dv = this.dataView;
        let offset = address;

        const red = dv.getUint8(offset++);
        const green = dv.getUint8(offset++);
        const blue = dv.getUint8(offset++);

        let remaining = dv.getUint16(offset, true);
        offset += 2;

        const size = 32;
        const pixels = new Uint8ClampedArray(size * size * 4);

        let pixel = 0;

        while (remaining > 0) {
            const transparent = dv.getUint16(offset, true);
            offset += 2;
            remaining -= 2;

            pixel += transparent * 4;

            if (remaining <= 0) break;

            const colored = dv.getUint16(offset, true);
            offset += 2;
            remaining -= 2;

            for (let i = 0; i < colored; i++) {
                const r = dv.getUint8(offset++);
                const g = dv.getUint8(offset++);
                const b = dv.getUint8(offset++);
                pixels[pixel++] = r;
                pixels[pixel++] = g;
                pixels[pixel++] = b;
                pixels[pixel++] = 255;
            }

            remaining -= colored * 3;
        }

        return new ImageData(pixels, size, size);
    }

    static loadFromBuffer(buffer: ArrayBuffer, clientVersion: number = 860): SpritesFile {
        const dv = new DataView(buffer);

        let offset = 0;
        const signature = dv.getUint32(offset, true);
        offset += 4;

        let spriteCount: number;
        if (clientVersion >= 960) {
            spriteCount = dv.getUint32(offset, true);
            offset += 4;
        } else {
            spriteCount = dv.getUint16(offset, true);
            offset += 2;
        }

        const addresses = new Uint32Array(spriteCount);
        for (let i = 0; i < spriteCount; i++) {
            addresses[i] = dv.getUint32(offset, true);
            offset += 4;
        }

        return new SpritesFile(buffer, spriteCount, addresses);
    }

    static async load(url: string, clientVersion: number = 860): Promise<SpritesFile> {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return SpritesFile.loadFromBuffer(buffer, clientVersion);
    }
}
