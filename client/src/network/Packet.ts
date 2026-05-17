export class Packet {
    private buffer: DataView;
    private offset: number = 0;

    constructor(data?: ArrayBuffer, byteOffset?: number, byteLength?: number) {
        if (data) {
            this.buffer = new DataView(data, byteOffset, byteLength);
        } else {
            this.buffer = new DataView(new ArrayBuffer(1024));
        }
    }

    // Adler-32 checksum implementation
    static calculateAdler32(data: Uint8Array): number {
        const Modulo = 65521;
        const Multiplier = 65536;
        let a = 1;
        let b = 0;

        for (let i = 0; i < data.length; i++) {
            a = (a + data[i]) % Modulo;
            b = (b + a) % Modulo;
        }
        
        return a + (b * Multiplier);
    }

    // Writers
    writeUint8(val: number) {
        this.buffer.setUint8(this.offset++, val);
    }

    writeUint16(val: number) {
        this.buffer.setUint16(this.offset, val, true);
        this.offset += 2;
    }

    writeUint32(val: number) {
        this.buffer.setUint32(this.offset, val, true);
        this.offset += 4;
    }

    writeString(val: string) {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(val);
        this.writeUint16(encoded.length);
        for (let i = 0; i < encoded.length; i++) {
            this.writeUint8(encoded[i]);
        }
    }

    writeBytes(bytes: Uint8Array) {
        for (let i = 0; i < bytes.length; i++) {
            this.writeUint8(bytes[i]);
        }
    }

    // Readers
    readUint8(): number {
        return this.buffer.getUint8(this.offset++);
    }

    readUint16(): number {
        const val = this.buffer.getUint16(this.offset, true);
        this.offset += 2;
        return val;
    }

    readUint32(): number {
        const val = this.buffer.getUint32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readBytes(length: number): Uint8Array {
        const bytes = new Uint8Array(this.buffer.buffer, this.buffer.byteOffset + this.offset, length);
        this.offset += length;
        return bytes;
    }

    readString(): string {
        const len = this.readUint16();
        if (len > 8192) {
            throw new Error(`String length too long: ${len}. Data likely corrupt or encrypted.`);
        }
        const decoder = new TextDecoder();
        const str = decoder.decode(new Uint8Array(this.buffer.buffer, this.buffer.byteOffset + this.offset, len));
        this.offset += len;
        return str;
    }

    getBinary(): Uint8Array {
        return new Uint8Array(this.buffer.buffer, 0, this.offset);
    }

    getOffset(): number {
        return this.offset;
    }

    canRead(length: number): boolean {
        return this.offset + length <= this.buffer.byteLength;
    }

    skipBytes(count: number): void {
        this.offset += count;
    }

    peekUint16(): number {
        return this.buffer.getUint16(this.offset, true);
    }

    remainingHex(max: number = 48): string {
        const available = Math.min(max, this.buffer.byteLength - this.offset);
        const bytes: string[] = [];
        for (let i = 0; i < available; i++) {
            bytes.push(this.buffer.getUint8(this.offset + i).toString(16).padStart(2, '0'));
        }
        return bytes.join(' ');
    }
}
