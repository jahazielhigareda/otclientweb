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

    prepareGame(account: string, password: string, charName: string): void {
        this.account = account;
        this.password = password;
        this.charName = charName;
    }

    // ── XTEA ───────────────────────────────────────────────────────────────

    private xteaEncrypt(data: Uint8Array): Uint8Array {
        const padding = 8 - (data.length % 8);
        const padded = new Uint8Array(data.length + padding);
        padded.set(data);
        const view = new DataView(padded.buffer);
        const k = this.xteaKeys;
        const delta = 0x9E3779B9;
        for (let i = 0; i < data.length; i += 8) {
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
        console.log(`[ProtocolGame] Sending EnterGame for character: ${this.charName}`);
        for (let i = 0; i < 4; i++) this.xteaKeys[i] = Math.floor(Math.random() * 0xFFFFFFFF);
        const packet = new Packet();
        packet.writeUint8(0x0A);
        packet.writeUint16(1);
        packet.writeUint16(860);
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
        this.encryptionEnabled = true;
    }

    // ── Outgoing helpers ───────────────────────────────────────────────────

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

        let opcodeRegion: Uint8Array;

        if (this.encryptionEnabled) {
            if (payload.length <= 4) return;
            const encryptedPart = payload.slice(4);
            if (encryptedPart.length < 8) return;
            const decrypted = this.xteaDecrypt(new Uint8Array(encryptedPart));
            opcodeRegion = decrypted.slice(2);
        } else {
            if (payload.length <= 4) return;
            opcodeRegion = payload.slice(4);
        }

        if (opcodeRegion.length === 0) return;
        const packet = new Packet(opcodeRegion.buffer as ArrayBuffer, opcodeRegion.byteOffset, opcodeRegion.byteLength);
        try {
            this.processPacket(packet);
        } catch (e) {
            console.warn('[ProtocolGame] processPacket error:', e);
        }
    }

    private processPacket(packet: Packet): void {
        while (packet.canRead(1)) {
            const opCode = packet.readUint8();

            switch (opCode) {
                case GameServerOpcodes.GameServerChallenge: {
                    if (!packet.canRead(5)) break;
                    this.challengeTimestamp = packet.readUint32();
                    this.challengeRandom = packet.readUint8();
                    console.log('[ProtocolGame] Challenge received, sending EnterGame...');
                    this.sendEnterGame();
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
                    const { x, y, z, tileCount, creatureCount } = this.parseFullMap(packet);
                    g_gameManager.setPosition(x, y, z);
                    console.log(`[ProtocolGame] Map parsed: ${tileCount} tiles, ${creatureCount} creatures at (${x},${y},${z})`);
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

                case GameServerOpcodes.GameServerMoveCreature: {
                    const fromX = packet.readUint16();
                    const fromY = packet.readUint16();
                    const fromZ = packet.readUint8();
                    const toX = packet.readUint16();
                    const toY = packet.readUint16();
                    const toZ = packet.readUint8();
                    const creatureId = g_gameMap.getTile(fromX, fromY, fromZ)?.creatureId;
                    if (creatureId) {
                        g_gameMap.moveCreature(creatureId, fromX, fromY, fromZ, toX, toY, toZ);
                    }
                    console.log(`[ProtocolGame] Move creature: (${fromX},${fromY},${fromZ}) -> (${toX},${toY},${toZ})`);
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
                    this.parseTileDescription(packet, utX, utY, utZ);
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
                case 0x0A: {
                    const playerId = packet.readUint32();
                    const _serverBeat = packet.readUint16();
                    g_gameManager.updatePlayer({ id: playerId });
                    console.log(`[ProtocolGame] LoginSuccess (0x0A) PlayerID=${playerId} beat=${_serverBeat}`);
                    break;
                }

                case 0x14: {
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
                    console.log(`[ProtocolGame] PlayerData (0x14): HP=${health}/${maxHealth} MP=${mana}/${maxMana} Lv=${level}`);
                    break;
                }

                case 0x15: {
                    const skills: string[] = [];
                    for (let i = 0; i < 7; i++) {
                        const val = packet.readUint16();
                        const pct = packet.readUint8();
                        skills.push(`${val}(${pct}%)`);
                    }
                    console.log(`[ProtocolGame] Skills (0x15): ${skills.join(', ')}`);
                    break;
                }

                case 0x16: {
                    const state = packet.readUint8();
                    console.log(`[ProtocolGame] PlayerState (0x16): 0x${state.toString(16)}`);
                    break;
                }

                case 0x32: {
                    const lightLevel = packet.readUint8();
                    const lightColor = packet.readUint8();
                    console.log(`[ProtocolGame] Light (0x32): level=${lightLevel} color=0x${lightColor.toString(16)}`);
                    break;
                }

                case 0x35: {
                    const coId = packet.readUint32();
                    const coLook = packet.readUint16();
                    const coHead = packet.readUint8();
                    const coBody = packet.readUint8();
                    const coLegs = packet.readUint8();
                    const coFeet = packet.readUint8();
                    const coAddons = packet.readUint8();
                    g_gameMap.updateCreatureOutfit(coId, coLook, coHead, coBody, coLegs, coFeet, coAddons);
                    console.log(`[ProtocolGame] CreatureOutfit (0x35): id=${coId}`);
                    break;
                }

                case 0x1E: {
                    console.log('[ProtocolGame] Ping (0x1E)');
                    break;
                }

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
                    console.warn(`[ProtocolGame] Unhandled opcode 0x${opCode.toString(16)}, remaining: ${packet.remainingHex(32)}`);
                    break;
            }
        }
    }

    private parseFullMap(packet: Packet): { x: number; y: number; z: number; tileCount: number; creatureCount: number } {
        const x = packet.readUint16();
        const y = packet.readUint16();
        const z = packet.readUint8();
        let tileCount = 0;
        let creatureCount = 0;

        for (let nz = 7; nz >= 0; nz--) {
            for (let nx = 0; nx < 18; nx++) {
                for (let ny = 0; ny < 14; ny++) {
                    const wx = x - 8 + nx;
                    const wy = y - 6 + ny;
                    const result = this.parseTileDescription(packet, wx, wy, nz);
                    if (result.thingCount > 0) tileCount++;
                    creatureCount += result.creatureCount;
                }
            }
        }

        return { x, y, z, tileCount, creatureCount };
    }

    private parseTileDescription(packet: Packet, tileX?: number, tileY?: number, tileZ?: number): { thingCount: number; creatureCount: number } {
        let thingCount = 0;
        let creatureCount = 0;
        let groundId: number | undefined;
        const itemIds: number[] = [];
        while (true) {
            if (!packet.canRead(2)) break;
            const inspect = packet.peekUint16();
            if (inspect >= 0xFF00) {
                packet.readUint16();
                break;
            }
            const result = this.parseThing(packet);
            thingCount++;
            if (result.isCreature) {
                creatureCount++;
                if (tileX !== undefined && result.creatureId) {
                    g_gameMap.addCreature(
                        result.creatureId, result.creatureName || '',
                        tileX, tileY!, tileZ!,
                        result.healthPct || 100, result.dir || 0,
                        result.lookType ? {
                            lookType: result.lookType, head: result.head || 0,
                            body: result.body || 0, legs: result.legs || 0,
                            feet: result.feet || 0, addons: result.addons || 0,
                        } : undefined
                    );
                }
            } else if (result.tibiaId !== undefined) {
                if (groundId === undefined) {
                    groundId = result.tibiaId;
                } else {
                    itemIds.push(result.tibiaId);
                }
            }
        }
        if (tileX !== undefined) {
            g_gameMap.setTile(tileX, tileY!, tileZ!, {
                groundId: groundId || undefined,
                itemIds: itemIds.length > 0 ? itemIds : undefined,
            });
        }
        return { thingCount, creatureCount };
    }

    private parseThing(packet: Packet): { isCreature: boolean; tibiaId?: number; creatureId?: number; creatureName?: string; healthPct?: number; dir?: number; lookType?: number; head?: number; body?: number; legs?: number; feet?: number; addons?: number } {
        const id = packet.readUint16();
        if (id === 0x0061 || id === 0x0062 || id === 0x0063) {
            packet.readUint32();
            const creatureId = packet.readUint32();
            const name = packet.readString();
            const healthPct = packet.readUint8();
            const dir = packet.readUint8();
            const lookType = packet.readUint16();
            const head = packet.readUint8();
            const body = packet.readUint8();
            const legs = packet.readUint8();
            const feet = packet.readUint8();
            const addons = packet.readUint8();
            packet.readUint8();
            packet.readUint8();
            packet.readUint16();
            packet.readUint8();
            packet.readUint8();
            console.log(`[ProtocolGame] Thing: Creature ${name} id=${creatureId} hp=${healthPct}% at lookType=${lookType}`);
            return { isCreature: true, creatureId, creatureName: name, healthPct, dir, lookType, head, body, legs, feet, addons };
        }
        return { isCreature: false, tibiaId: id };
    }
}
