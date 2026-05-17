import { Protocol } from '../Protocol';
import { Connection } from '../Connection';
import { Packet } from '../Packet';
import { LoginServerOpts, ClientOpcodes, GameServerOpcodes } from '../ProtocolCodes';

export class ProtocolLogin extends Protocol {
    private account:  string = '';
    private password: string = '';
    private challengeTimestamp: number = 0;
    private challengeRandom:    number = 0;
    private xteaKeys: Uint32Array = new Uint32Array(4);

    constructor(connection: Connection) {
        super(connection);
        for (let i = 0; i < 4; i++) {
            this.xteaKeys[i] = Math.floor(Math.random() * 0xFFFFFFFF);
        }
    }

    prepareLogin(account: string, password: string): void {
        this.account  = account;
        this.password = password;
    }

    // ── XTEA ───────────────────────────────────────────────────────────────

    private xteaDecrypt(data: Uint8Array): Uint8Array {
        if (data.length < 8 || data.length % 8 !== 0) return data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const k = this.xteaKeys;
        const delta = 0x9E3779B9;
        for (let i = 0; i < data.length; i += 8) {
            let v0 = view.getUint32(i, true);
            let v1 = view.getUint32(i + 4, true);
            let sum = 0xC6EF3720;
            for (let j = 0; j < 32; j++) {
                v1 -= (((v0 << 4) ^ (v0 >>> 5)) + v0) ^ (sum + k[(sum >>> 11) & 3]);
                sum = (sum - delta) >>> 0;
                v0 -= (((v1 << 4) ^ (v1 >>> 5)) + v1) ^ (sum + k[sum & 3]);
            }
            view.setUint32(i, v0, true);
            view.setUint32(i + 4, v1, true);
        }
        return data;
    }

    // ── RSA ────────────────────────────────────────────────────────────────

    private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
        let res = 1n;
        base = base % mod;
        while (exp > 0n) {
            if (exp % 2n === 1n) res = (res * base) % mod;
            base = (base * base) % mod;
            exp  = exp / 2n;
        }
        return res;
    }

    private encryptRSA(data: Uint8Array): Uint8Array {
        const N = BigInt('109120132967399429278860960508995541528237502902798129123468757937266291492576446330739696001110603907230888610072655818825358503429057592827629436413108566029093628212635953836686562675849720620786279431090218017681061521755056710823876476444260558147179707119674283982419152118103759076030616683978566631413');
        const E = BigInt(65537);
        const le = new Uint8Array(data.length + 1);
        for (let i = 0; i < data.length; i++) le[i] = data[data.length - 1 - i];
        le[data.length] = 0;
        let m = 0n;
        for (let i = 0; i < le.length; i++) m |= BigInt(le[i]) << (BigInt(i) * 8n);
        const c = this.modPow(m, E, N);
        const result = new Uint8Array(128);
        let tmp = c;
        for (let i = 127; i >= 0; i--) { result[i] = Number(tmp & 0xffn); tmp >>= 8n; }
        return result;
    }

    public sendLoginPacket(): void {
        console.log(`[ProtocolLogin] Sending LoginPacket (RSA)`);
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientEnterAccount);
        packet.writeUint16(1);             
        packet.writeUint16(860);           
        packet.writeUint32(1277983123);    
        packet.writeUint32(1277298068);    
        packet.writeUint32(1256571859);    

        const plain = new Packet();
        plain.writeUint8(0x00);
        plain.writeUint32(this.xteaKeys[0]);
        plain.writeUint32(this.xteaKeys[1]);
        plain.writeUint32(this.xteaKeys[2]);
        plain.writeUint32(this.xteaKeys[3]);
        plain.writeString(this.account);
        plain.writeString(this.password);

        const padded = new Uint8Array(128);
        padded.set(plain.getBinary());
        packet.writeBytes(this.encryptRSA(padded));
        this.connection.sendFramedPacket(packet.getBinary());
    }

    private toHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }

    private isKnownOpcode(op: number): boolean {
        return [
            LoginServerOpts.LoginServerError,
            LoginServerOpts.LoginServerMotd,
            LoginServerOpts.LoginServerCharacterList,
            GameServerOpcodes.GameServerChallenge,
            GameServerOpcodes.GameServerLoginWait,   
            35, 0x1f
        ].includes(op);
    }

    handlePacket(data: ArrayBuffer): void {
        const raw = new Uint8Array(data);
        if (raw.length < 2) return;
        const payload = raw.slice(2);

        // MTOTS Envelope: [Size 2b][Adler 4b][XTEA( [Size 2b][Payload...] )]
        
        if (payload.length >= 14) {
            const encryptedPart = payload.slice(4); 
            if (encryptedPart.length % 8 === 0) {
                const decrypted = this.xteaDecrypt(new Uint8Array(encryptedPart));
                const innerOp = decrypted[2];
                if (this.isKnownOpcode(innerOp)) {
                    console.log(`[ProtocolLogin] XTEA OK (Opcode 0x${innerOp.toString(16)})`);
                    return this.processPacket(decrypted.slice(2)); 
                }
                if (this.isKnownOpcode(decrypted[0])) {
                    console.log(`[ProtocolLogin] XTEA OK (Opcode at 0: 0x${decrypted[0].toString(16)})`);
                    return this.processPacket(decrypted);
                }
            }
        }

        if (this.isKnownOpcode(payload[0])) return this.processPacket(payload);
        if (payload.length >= 5 && this.isKnownOpcode(payload[4])) return this.processPacket(payload.slice(4));

        console.warn(`[ProtocolLogin] Unknown packet structure.`);
    }

    private processPacket(data: Uint8Array): void {
        const packet = new Packet(data.buffer as any, data.byteOffset, data.byteLength);
        
        while (packet.getOffset() < data.length) {
            const opCode = packet.readUint8();
            if (opCode === 0) break; 

            console.log(`[ProtocolLogin] Processing Opcode 0x${opCode.toString(16)}`);

            switch (opCode) {
                case LoginServerOpts.LoginServerMotd:
                    // MTOTS handles MOTD as a single string: "ID\nMessage"
                    const motdRaw = packet.readString();
                    const [motdId, ...motdParts] = motdRaw.split('\n');
                    const motdMsg = motdParts.join('\n');
                    console.log(`[ProtocolLogin] MOTD (${motdId}): ${motdMsg}`);
                    window.dispatchEvent(new CustomEvent('motd_received', { 
                        detail: { id: motdId, message: motdMsg } 
                    }));
                    break;

                case LoginServerOpts.LoginServerCharacterList:
                    const charCount = packet.readUint8();
                    const chars: any[] = [];
                    for (let i = 0; i < charCount; i++) {
                        const name = packet.readString();
                        const world = packet.readString();
                        const ip = Array.from(packet.readBytes(4)).join('.');
                        const port = packet.readUint16();
                        chars.push({ name, world, ip, port, previewState: false });
                    }
                    const premiumDays = packet.readUint16();
                    console.log(`[ProtocolLogin] Success! Received ${chars.length} characters.`);
                    
                    window.dispatchEvent(new CustomEvent('login_success', { 
                        detail: { account: this.account, password: this.password } 
                    }));

                    // Delay character list event slightly to ensure the CharSelectWindow component is mounted
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('char_list_received', { 
                            detail: { characters: chars, premiumDays } 
                        }));
                    }, 100);
                    return; 

                case LoginServerOpts.LoginServerError:
                    const errorMsg = packet.readString();
                    window.dispatchEvent(new CustomEvent('login_error', { detail: errorMsg }));
                    return;

                case 0x1f:
                case GameServerOpcodes.GameServerChallenge:
                    this.challengeTimestamp = packet.readUint32();
                    this.challengeRandom = packet.readUint8();
                    this.sendLoginPacket();
                    return;

                default:
                    console.warn(`[ProtocolLogin] Opcode 0x${opCode.toString(16)} unhandled.`);
                    return;
            }
        }
    }
}
