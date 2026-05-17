import { Protocol } from '../Protocol';
import { Packet } from '../Packet';
import { GameServerOpcodes, ClientOpcodes } from '../ProtocolCodes';
import { g_gameManager } from '../../core/GameManager';
import { g_gameMap } from '../../core/GameMap';

export class ProtocolGame extends Protocol {
    private account: string = '';
    private password: string = '';
    private charName: string = '';
    private challengeTimestamp: number = 0;
    private challengeRandom: number = 0;
    private xteaKeys: Uint32Array = new Uint32Array(4);
    private encryptionEnabled: boolean = false;

    private awareWidth: number = 18;
    private awareHeight: number = 14;

    prepareGame(account: string, password: string, charName: string): void {
        this.account = account;
        this.password = password;
        this.charName = charName;
    }

    // ── XTEA ───────────────────────────────────────────────────────────────

    private xteaEncrypt(data: Uint8Array): Uint8Array {
        const remainder = data.length % 8;
        const padding = remainder === 0 ? 0 : 8 - remainder;
        const padded = new Uint8Array(data.length + padding);
        padded.set(data);
        const view = new DataView(padded.buffer);
        const k = this.xteaKeys;
        const delta = 0x9E3779B9;
        for (let i = 0; i < padded.length; i += 8) { // FIX: padded.length, not data.length
            let v0 = view.getUint32(i, true);
            let v1 = view.getUint32(i + 4, true);
            let sum = 0;
            for (let j = 0; j < 32; j++) {
                v0 += (((v1 << 4) ^ (v1 >>> 5)) + v1) ^ (sum + k[sum & 3]);
                sum = (sum + delta) >>> 0;
                v1 += (((v0 << 4) ^ (v0 >>> 5)) + v0) ^ (sum + k[(sum >>> 11) & 3]);
            }
            view.setUint32(i, v0, true);
            view.setUint32(i + 4, v1, true);
        }
        return padded;
    }

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
            exp = exp / 2n;
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

    private sendPacket(packet: Packet): void {
        const data = packet.getBinary();
        let payload: Uint8Array;
        if (this.encryptionEnabled) {
            const framed = new Uint8Array(2 + data.length);
            new DataView(framed.buffer).setUint16(0, data.length, true);
            framed.set(data, 2);
            payload = this.xteaEncrypt(framed);
        } else {
            payload = data;
        }
        const final = new Uint8Array(6 + payload.length);
        const view = new DataView(final.buffer);
        view.setUint16(0, payload.length + 4, true);
        view.setUint32(2, Packet.calculateAdler32(payload), true);
        final.set(payload, 6);
        this.connection.send(final);
    }

    private sendEnterGame(): void {
        for (let i = 0; i < 4; i++) this.xteaKeys[i] = Math.floor(Math.random() * 0xFFFFFFFF);
        const packet = new Packet();
        packet.writeUint8(0x0A);
        packet.writeUint16(2);   // OS: 2 = Windows (TFS expects 2, not 1)
        packet.writeUint16(860); // client version
        const plain = new Packet();
        plain.writeUint8(0x00);
        for (let i = 0; i < 4; i++) plain.writeUint32(this.xteaKeys[i]);
        plain.writeUint8(0);
        plain.writeString(this.account);
        plain.writeString(this.charName);
        plain.writeString(this.password);
        plain.writeUint32(this.challengeTimestamp);
        plain.writeUint8(this.challengeRandom);
        const padded = new Uint8Array(128);
        padded.set(plain.getBinary());
        packet.writeBytes(this.encryptRSA(padded));
        this.sendPacket(packet);
        this.encryptionEnabled = true; // server will encrypt all subsequent packets
        const hex = (b: Uint8Array, n: number) => Array.from(b.slice(0,n)).map(x=>x.toString(16).padStart(2,'0')).join(' ');
        console.log(`[ProtocolGame] EnterGame sent: account="${this.account}" char="${this.charName}" ts=${this.challengeTimestamp} rand=${this.challengeRandom} keys=[${Array.from(this.xteaKeys).map(k=>k.toString(16)).join(',')}]`);
    }

    // ── Outgoing helpers ───────────────────────────────────────────────────

    sendEnterGameAck(): void {
        const packet = new Packet();
        packet.writeUint8(0x0F); // ClientEnterGame — sent in response to GameServerLoginOrPendingState (0x0A)
        this.sendPacket(packet);
    }

    sendPingBack(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientPingBack);
        this.sendPacket(packet);
    }

    sendWalkNorth(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientWalkNorth);
        this.sendPacket(packet);
    }

    sendWalkEast(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientWalkEast);
        this.sendPacket(packet);
    }

    sendWalkSouth(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientWalkSouth);
        this.sendPacket(packet);
    }

    sendWalkWest(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientWalkWest);
        this.sendPacket(packet);
    }

    sendStop(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientStop);
        this.sendPacket(packet);
    }

    sendTalk(message: string): void {
        if (!message.trim()) return;
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientTalk);
        packet.writeUint8(1);
        packet.writeString(message.trim());
        this.sendPacket(packet);
    }

    // ── Incoming packets ───────────────────────────────────────────────────

    handlePacket(data: ArrayBuffer): void {
        const raw = new Uint8Array(data);
        if (raw.length < 2) return;
        const payload = raw.slice(2);
        const firstBytes = Array.from(payload.slice(0, Math.min(8, payload.length))).map(b => b.toString(16).padStart(2,'0')).join(' ');
        console.log(`[ProtocolGame] handlePacket: ${payload.length} bytes, enc=${this.encryptionEnabled}, first=${firstBytes}`);

        let opcodeRegion: Uint8Array;

        if (this.encryptionEnabled) {
            if (payload.length <= 4) return;
            const encryptedPart = payload.slice(4);
            if (encryptedPart.length < 8) return;
            const decrypted = this.xteaDecrypt(new Uint8Array(encryptedPart));
            const decFirst = Array.from(decrypted.slice(0, Math.min(8, decrypted.length))).map(b => b.toString(16).padStart(2,'0')).join(' ');
            console.log(`[ProtocolGame] Decrypted: ${decrypted.length} bytes, first=${decFirst}`);
            opcodeRegion = decrypted.slice(2);
        } else {
            if (payload.length <= 4) return;
            opcodeRegion = payload.slice(4);
        }

        if (opcodeRegion.length === 0) return;
        const packet = new Packet(opcodeRegion.buffer as ArrayBuffer, opcodeRegion.byteOffset, opcodeRegion.byteLength);
        this.processPacket(packet);
    }

    private processPacket(packet: Packet): void {
        while (packet.canRead(1)) {
            const opCode = packet.readUint8();
            console.log(`[Proto] opcode=0x${opCode.toString(16).padStart(2,'0')} (${opCode}), remaining=${packet.remainingHex(8)}`);

            switch (opCode) {
                case 0x06: { // Pre-challenge marker — 1 byte payload, then Challenge follows in the same frame.
                    // Server signals it is about to send a Challenge. The actual login response
                    // (0x0A — ClientPendingGame) must wait for the Challenge that follows; sending
                    // 0x0F here is the bug that caused MTOTS to drop the connection.
                    if (packet.canRead(1)) packet.readUint8();
                    console.log('[ProtocolGame] Pre-challenge marker (0x06) received');
                    break;
                }

                case GameServerOpcodes.GameServerChallenge: {
                    if (!packet.canRead(5)) break;
                    this.challengeTimestamp = packet.readUint32();
                    this.challengeRandom = packet.readUint8();
                    console.log('[ProtocolGame] Challenge received, sending EnterGame...');
                    this.sendEnterGame();
                    break;
                }

                case GameServerOpcodes.GameServerChangeMapAwareRange: {
                    this.awareWidth = packet.readUint16();
                    this.awareHeight = packet.readUint16();
                    console.log(`[ProtocolGame] AwareRange changed: ${this.awareWidth}x${this.awareHeight}`);
                    break;
                }

                case GameServerOpcodes.GameServerLoginSuccess: {
                    const playerId = packet.readUint32();
                    const _serverBeat = packet.readUint16();
                    g_gameManager.updatePlayer({ id: playerId });
                    console.log(`[ProtocolGame] Login Success! PlayerID=${playerId}`);
                    break;
                }

                case GameServerOpcodes.GameServerFullMap: {
                    this.parseFullMap(packet);
                    break;
                }

                case GameServerOpcodes.GameServerPlayerData: {
                    const health = packet.readUint16();
                    const maxHealth = packet.readUint16();
                    const capacity = packet.readUint32();
                    const experience = packet.readUint32();
                    const level = packet.readUint16();
                    const _levelPercent = packet.readUint8();
                    const mana = packet.readUint16();
                    const maxMana = packet.readUint16();
                    const magicLevel = packet.readUint8();
                    const _magicLevelPercent = packet.readUint8();
                    const soul = packet.readUint8();
                    const stamina = packet.readUint16();
                    g_gameManager.updatePlayer({
                        hp: health, maxHp: maxHealth, mana, maxMana, level,
                        experience, capacity, soul, stamina, magicLevel,
                    });
                    console.log(`[ProtocolGame] Player stats: HP=${health}/${maxHealth} MP=${mana}/${maxMana} Lv=${level}`);
                    break;
                }

                case GameServerOpcodes.GameServerPlayerDataBasic: {
                    const exp = packet.readUint32();
                    const lvl = packet.readUint16();
                    const _lvlPct = packet.readUint8();
                    g_gameManager.updatePlayer({ experience: exp, level: lvl });
                    console.log(`[ProtocolGame] Player basic: Lv=${lvl} Exp=${exp}`);
                    break;
                }

                case GameServerOpcodes.GameServerPlayerSkills: {
                    const skills: string[] = [];
                    for (let i = 0; i < 7; i++) {
                        const val = packet.readUint16();
                        const pct = packet.readUint8();
                        skills.push(`${val}(${pct}%)`);
                    }
                    console.log(`[ProtocolGame] Skills: ${skills.join(', ')}`);
                    break;
                }

                case GameServerOpcodes.GameServerPlayerState: {
                    const state = packet.readUint8();
                    console.log(`[ProtocolGame] Player state flags: 0x${state.toString(16)}`);
                    break;
                }

                case GameServerOpcodes.GameServerAmbient: {
                    const lightLevel = packet.readUint8();
                    const lightColor = packet.readUint8();
                    console.log(`[ProtocolGame] Ambient light: level=${lightLevel} color=0x${lightColor.toString(16)}`);
                    break;
                }

                case GameServerOpcodes.GameServerTextMessage: {
                    const _msgType = packet.readUint8();
                    const message = packet.readString();
                    window.dispatchEvent(new CustomEvent('game_text_message', { detail: { message } }));
                    break;
                }

                case GameServerOpcodes.GameServerPing: {
                    this.sendPingBack();
                    break;
                }

                case GameServerOpcodes.GameServerPingBack: {
                    console.log('[ProtocolGame] PingBack received');
                    break;
                }

                case GameServerOpcodes.GameServerCreatureData: {
                    const creatureId = packet.readUint32();
                    const name = packet.readString();
                    const hpPct = packet.readUint8();
                    const dir = packet.readUint8();
                    const lookType = packet.readUint16();
                    const head = packet.readUint8();
                    const body = packet.readUint8();
                    const legs = packet.readUint8();
                    const feet = packet.readUint8();
                    const addons = packet.readUint8();
                    const cx = packet.readUint16();
                    const cy = packet.readUint16();
                    const cz = packet.readUint8();
                    g_gameMap.addCreature(creatureId, name, cx, cy, cz, hpPct, dir, { lookType, head, body, legs, feet, addons });
                    console.log(`[ProtocolGame] Creature: ${name} id=${creatureId} hp=${hpPct}% at (${cx},${cy},${cz})`);
                    break;
                }

                case GameServerOpcodes.GameServerCreatureHealth: {
                    const chId = packet.readUint32();
                    const chHp = packet.readUint8();
                    g_gameMap.updateCreatureHealth(chId, chHp);
                    console.log(`[ProtocolGame] Creature health: id=${chId} hp=${chHp}%`);
                    break;
                }

                case GameServerOpcodes.GameServerCreatureOutfit: {
                    const coId = packet.readUint32();
                    const coLook = packet.readUint16();
                    const coHead = packet.readUint8();
                    const coBody = packet.readUint8();
                    const coLegs = packet.readUint8();
                    const coFeet = packet.readUint8();
                    const coAddons = packet.readUint8();
                    g_gameMap.updateCreatureOutfit(coId, coLook, coHead, coBody, coLegs, coFeet, coAddons);
                    console.log(`[ProtocolGame] Creature outfit: id=${coId}`);
                    break;
                }

                case GameServerOpcodes.GameServerCreatureSpeed: {
                    const csId = packet.readUint32();
                    const csSpeed = packet.readUint16();
                    console.log(`[ProtocolGame] Creature speed: id=${csId} speed=${csSpeed}`);
                    break;
                }

                case GameServerOpcodes.GameServerLoginOrPendingState: {
                    const playerId = packet.readUint32();
                    const _serverBeat = packet.readUint16();
                    // 8.60: 1 trailing byte (canReportBugs). >=1054 and >=1058 features add more,
                    // but they don't apply at this protocol version.
                    if (packet.canRead(1)) packet.readUint8();
                    g_gameManager.updatePlayer({ id: playerId });
                    console.log(`[ProtocolGame] LoginOrPendingState (0x0A): PlayerID=${playerId} — sending ClientEnterGame (0x0F)`);
                    this.sendEnterGameAck();
                    break;
                }

                case GameServerOpcodes.GameServerEnterGame: {
                    // 0x0F — some server builds send this after 0x0A, encrypted.
                    // encryptionEnabled is already true from 0x0A handler above.
                    console.log('[ProtocolGame] EnterGame (0x0F) confirmed');
                    window.dispatchEvent(new CustomEvent('game_enter'));
                    break;
                }

                case GameServerOpcodes.GameServerMapTopRow: {
                    const z = packet.readUint8();
                    const player = g_gameManager.player;
                    let skip = 0;
                    for (let x = player.x - 8; x <= player.x + 9; x++) {
                        if (skip > 0) { skip--; continue; }
                        const result = this.setTileDescription(packet, x, player.y - 7, z);
                        skip = result.skip;
                    }
                    break;
                }

                case GameServerOpcodes.GameServerMapRightRow: {
                    const z = packet.readUint8();
                    const player = g_gameManager.player;
                    let skip = 0;
                    for (let y = player.y - 6; y <= player.y + 7; y++) {
                        if (skip > 0) { skip--; continue; }
                        const result = this.setTileDescription(packet, player.x + 10, y, z);
                        skip = result.skip;
                    }
                    break;
                }

                case GameServerOpcodes.GameServerMapBottomRow: {
                    const z = packet.readUint8();
                    const player = g_gameManager.player;
                    let skip = 0;
                    for (let x = player.x - 8; x <= player.x + 9; x++) {
                        if (skip > 0) { skip--; continue; }
                        const result = this.setTileDescription(packet, x, player.y + 8, z);
                        skip = result.skip;
                    }
                    break;
                }

                case GameServerOpcodes.GameServerMapLeftRow: {
                    const z = packet.readUint8();
                    const player = g_gameManager.player;
                    let skip = 0;
                    for (let y = player.y - 6; y <= player.y + 7; y++) {
                        if (skip > 0) { skip--; continue; }
                        const result = this.setTileDescription(packet, player.x - 9, y, z);
                        skip = result.skip;
                    }
                    break;
                }

                case GameServerOpcodes.GameServerMoveCreature: {
                    let creatureId: number;
                    let fromX = 0, fromY = 0, fromZ = 0;
                    const x = packet.readUint16();
                    if (x === 0xFFFF) {
                        creatureId = packet.readUint32();
                    } else {
                        fromX = x;
                        fromY = packet.readUint16();
                        fromZ = packet.readUint8();
                        packet.readUint8(); // stackpos
                        const tile = g_gameMap.getTile(fromX, fromY, fromZ);
                        creatureId = tile?.creatureId || 0;
                    }
                    const toX = packet.readUint16();
                    const toY = packet.readUint16();
                    const toZ = packet.readUint8();
                    if (creatureId) {
                        g_gameMap.moveCreature(creatureId, fromX, fromY, fromZ, toX, toY, toZ);
                    }
                    break;
                }

                case GameServerOpcodes.GameServerCreateOnMap: {
                    const cmX = packet.readUint16();
                    const cmY = packet.readUint16();
                    const cmZ = packet.readUint8();
                    console.log(`[ProtocolGame] Create on map at (${cmX},${cmY},${cmZ})`);
                    this.parseThing(packet);
                    break;
                }

                case GameServerOpcodes.GameServerDeleteOnMap: {
                    const dlX = packet.readUint16();
                    const dlY = packet.readUint16();
                    const dlZ = packet.readUint8();
                    const _stackPos = packet.readUint8();
                    g_gameMap.removeTile(dlX, dlY, dlZ);
                    console.log(`[ProtocolGame] Delete from map at (${dlX},${dlY},${dlZ})`);
                    break;
                }

                case GameServerOpcodes.GameServerUpdateTile: {
                    const utX = packet.readUint16();
                    const utY = packet.readUint16();
                    const utZ = packet.readUint8();
                    console.log(`[ProtocolGame] Update tile at (${utX},${utY},${utZ})`);
                    this.setTileDescription(packet, utX, utY, utZ);
                    break;
                }

                case GameServerOpcodes.GameServerSetInventory: {
                    const slot = packet.readUint8();
                    console.log(`[ProtocolGame] Set inventory slot ${slot}`);
                    this.parseThing(packet);
                    break;
                }

                case GameServerOpcodes.GameServerGraphicalEffect: {
                    const geX = packet.readUint16();
                    const geY = packet.readUint16();
                    const geZ = packet.readUint8();
                    const geType = packet.readUint8();
                    console.log(`[ProtocolGame] Graphical effect type=${geType} at (${geX},${geY},${geZ})`);
                    break;
                }

                case GameServerOpcodes.GameServerMissleEffect: {
                    const msX = packet.readUint16();
                    const msY = packet.readUint16();
                    const msZ = packet.readUint8();
                    const msType = packet.readUint8();
                    console.log(`[ProtocolGame] Missile effect type=${msType} at (${msX},${msY},${msZ})`);
                    break;
                }

                case GameServerOpcodes.GameServerFloorChangeUp: {
                    console.log('[ProtocolGame] Floor change UP');
                    break;
                }

                case GameServerOpcodes.GameServerFloorChangeDown: {
                    console.log('[ProtocolGame] Floor change DOWN');
                    break;
                }

                case GameServerOpcodes.GameServerCancelWalk: {
                    const dir = packet.readUint8();
                    console.log(`[ProtocolGame] Cancel walk direction=${dir}`);
                    break;
                }

                // ── 8.60 native opcodes ────────────────────────────────────
                case 0x00:
                case 0x54: {
                    break;
                }

                case 0x2E: {
                    break;
                }

                case 0xA0: {
                    const _msgType = packet.readUint8();
                    const message = packet.readString();
                    window.dispatchEvent(new CustomEvent('game_text_message', { detail: { message } }));
                    console.log(`[ProtocolGame] TextMessage (0xA0): ${message}`);
                    break;
                }

                default:
                    console.error(`[ProtocolGame] UNHANDLED opcode 0x${opCode.toString(16)} (${opCode}), remaining bytes: ${packet.remainingHex(48)}`);
                    return; // can't safely skip unknown opcode, abort this packet
                }
            }
        }

    private parseFullMap(packet: Packet): { x: number; y: number; z: number; tileCount: number; creatureCount: number } {
        const x = packet.readUint16();
        const y = packet.readUint16();
        const z = packet.readUint8();

        // Set position FIRST so camera is correct even if parsing below partially fails
        g_gameManager.setPosition(x, y, z);
        console.log(`[ProtocolGame] FullMap: player at (${x},${y},${z}), awareRange=${this.awareWidth}x${this.awareHeight}`);

        let skip = 0;
        let tileCount = 0;
        let creatureCount = 0;

        const startX = x - Math.floor(this.awareWidth / 2);
        const startY = y - Math.floor(this.awareHeight / 2);
        console.log(`[ProtocolGame] FullMap: tile origin (${startX},${startY}), size ${this.awareWidth}x${this.awareHeight}`);

        if (z <= 7) {
            // Surface: iterate from floor 7 down to 0 (otclient's convention).
            // For each nz, the offset z - nz lets the displaced tiles end up at the
            // correct world z. Tiles for the floor below the player (nz=7 when z=6)
            // are stored at z=7 with x/y shifted by -1.
            for (let nz = 7; nz >= 0; nz--) {
                skip = this.setFloorDescription(packet, startX, startY, nz, this.awareWidth, this.awareHeight, z - nz, skip, (tc) => tileCount += tc, (cc) => creatureCount += cc);
            }
        } else {
            // Underground: iterate z-2 to z+2
            for (let nz = z - 2; nz <= z + 2; nz++) {
                skip = this.setFloorDescription(packet, startX, startY, nz, this.awareWidth, this.awareHeight, z - nz, skip, (tc) => tileCount += tc, (cc) => creatureCount += cc);
            }
        }

        console.log(`[ProtocolGame] FullMap parsed: ${tileCount} tiles with ground, ${creatureCount} creatures. Total tiles in map: ${g_gameMap.tileCount()}`);
        const byZ = new Map<number, number>();
        for (let zz = 0; zz <= 15; zz++) {
            let n = 0;
            for (let xx = x - 9; xx <= x + 9; xx++) {
                for (let yy = y - 7; yy <= y + 7; yy++) {
                    if (g_gameMap.getTile(xx, yy, zz)) n++;
                }
            }
            if (n > 0) byZ.set(zz, n);
        }
        console.log(`[ProtocolGame] Tiles per z (near player ${x},${y}): ${Array.from(byZ.entries()).map(([z,n]) => `z${z}=${n}`).join(' ')}`);
        window.dispatchEvent(new CustomEvent('map_loaded'));

        return { x, y, z, tileCount, creatureCount };
    }

    private setFloorDescription(packet: Packet, x: number, y: number, z: number, 
                                 width: number, height: number, offset: number, skip: number, 
                                 onTile: (n: number) => void, onCreature: (n: number) => void): number {
        for (let nx = 0; nx < width; nx++) {
            for (let ny = 0; ny < height; ny++) {
                if (skip > 0) {
                    skip--;
                    continue;
                }
                const result = this.setTileDescription(packet, x + nx + offset, y + ny + offset, z);
                if (result.thingCount > 0) onTile(1);
                onCreature(result.creatureCount);
                if (result.skip > 0) {
                    skip = result.skip;
                }
            }
        }
        return skip;
    }

    private setTileDescription(packet: Packet, tileX: number, tileY: number, tileZ: number): { thingCount: number; creatureCount: number; skip: number } {
        let thingCount = 0;
        let creatureCount = 0;
        const things: { type: 'item' | 'creature'; id: number }[] = [];
        let skipCount = 0;

        for (let stackPos = 0; stackPos < 256; stackPos++) {
            if (!packet.canRead(2)) break;
            const inspect = packet.peekUint16();

            if (inspect >= 0xFF00) {
                packet.readUint16();
                skipCount = inspect & 0x00FF;
                break;
            }

            const result = this.parseThing(packet);
            thingCount++;
            if (result.isCreature) {
                creatureCount++;
                if (result.creatureId) {
                    g_gameMap.addCreature(
                        result.creatureId, result.creatureName || '',
                        tileX, tileY, tileZ,
                        result.healthPct || 100, result.dir || 0,
                        result.lookType ? {
                            lookType: result.lookType, head: result.head || 0,
                            body: result.body || 0, legs: result.legs || 0,
                            feet: result.feet || 0, addons: result.addons || 0,
                        } : undefined
                    );
                    things.push({ type: 'creature', id: result.creatureId });
                }
            } else if (result.tibiaId !== undefined) {
                things.push({ type: 'item', id: result.tibiaId });
            }
        }

        if (thingCount > 0) {
            g_gameMap.setTile(tileX, tileY, tileZ, things);
        }

        return { thingCount, creatureCount, skip: skipCount };
    }

    private parseThing(packet: Packet): { isCreature: boolean; tibiaId?: number; creatureId?: number; creatureName?: string; healthPct?: number; dir?: number; lookType?: number; head?: number; body?: number; legs?: number; feet?: number; addons?: number } {
        const id = packet.readUint16();

        if (id === 0x0061) { // UnknownCreature — new creature the client hasn't seen before
            try {
                const _removeId = packet.readUint32(); // creature to remove from known list
                const creatureId = packet.readUint32();
                // NOTE: no creatureType byte in protocol 8.60
                const name = packet.readString();
                const healthPct = packet.readUint8();
                const dir = packet.readUint8();
                const lookType = packet.readUint16();
                let head = 0, body = 0, legs = 0, feet = 0, addons = 0;
                if (lookType !== 0) {
                    head = packet.readUint8();
                    body = packet.readUint8();
                    legs = packet.readUint8();
                    feet = packet.readUint8();
                    addons = packet.readUint8();
                    // NOTE: no mount field in protocol 8.60
                } else {
                    packet.readUint16(); // lookTypeEx (item on the ground representing creature)
                }
                packet.readUint8();  // light intensity
                packet.readUint8();  // light color
                packet.readUint16(); // speed
                packet.readUint8();  // skull
                packet.readUint8();  // shield/party
                packet.readUint8();  // unpass (passable flag) — present in 8.60 (>=854)
                return { isCreature: true, creatureId, creatureName: name, healthPct, dir, lookType, head, body, legs, feet, addons };
            } catch (e) {
                console.warn(`[ProtocolGame] Failed to parse UnknownCreature:`, e);
                return { isCreature: false, tibiaId: id };
            }
        }

        if (id === 0x0062) { // OutdatedCreature — creature the client knows, resend outfit
            const creatureId = packet.readUint32();
            const healthPct = packet.readUint8();
            const dir = packet.readUint8();
            const lookType = packet.readUint16();
            let head = 0, body = 0, legs = 0, feet = 0, addons = 0;
            if (lookType !== 0) {
                head = packet.readUint8();
                body = packet.readUint8();
                legs = packet.readUint8();
                feet = packet.readUint8();
                addons = packet.readUint8();
                // NOTE: no mount field in protocol 8.60
            } else {
                packet.readUint16(); // lookTypeEx
            }
            packet.readUint8();  // light intensity
            packet.readUint8();  // light color
            packet.readUint16(); // speed
            packet.readUint8();  // skull
            packet.readUint8();  // shield/party
            packet.readUint8();  // unpass
            return { isCreature: true, creatureId, healthPct, dir, lookType, head, body, legs, feet, addons };
        }

        if (id === 0x0063) { // Creature — known creature, only direction update
            const creatureId = packet.readUint32();
            const dir = packet.readUint8(); // direction update
            return { isCreature: true, creatureId, dir };
        }

        return { isCreature: false, tibiaId: id };
    }
}
