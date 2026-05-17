import { Connection } from './Connection';
import { Protocol } from './Protocol';
import { ProtocolLogin } from './protocols/ProtocolLogin';
import { ProtocolGame } from './protocols/ProtocolGame';
import type { ConnectionState } from './types';

export class NetworkManager {
    private static instance: NetworkManager;
    private connection: Connection;
    private currentProtocol: Protocol | null = null;
    public state: ConnectionState = 'DISCONNECTED';

    private constructor() {
        this.connection = new Connection();
    }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) NetworkManager.instance = new NetworkManager();
        return NetworkManager.instance;
    }

    // Login server (port 7171) — only account + password
    async connect(url: string, account: string, password: string): Promise<void> {
        if (this.connection.isConnected()) this.connection.disconnect();
        this.connection = new Connection();

        // Append port=7171 to the proxy URL
        const proxyUrl = `ws://localhost:8081?port=7171`;

        try {
            await this.connection.connect(proxyUrl);
            this.state = 'CONNECTED';
            const proto = new ProtocolLogin(this.connection);
            proto.prepareLogin(account, password);
            this.setProtocol(proto);
            proto.sendLoginPacket();
            console.log('[NetworkManager] Connected to login server (via proxy) — sending login packet…');
        } catch (err) {
            this.state = 'DISCONNECTED';
            throw err;
        }
    }

    // Game server (port 7172) — called after character selection
    async connectGameWorld(ip: string, port: number, account: string, password: string, charName: string): Promise<void> {
        if (this.connection.isConnected()) this.connection.disconnect();
        this.connection = new Connection();

        // Append port=7172 to the proxy URL
        const proxyUrl = `ws://localhost:8081?port=${port}`; 

        try {
            await this.connection.connect(proxyUrl);
            this.state = 'CONNECTED';

            const proto = new ProtocolGame(this.connection);
            proto.prepareGame(account, password, charName);
            this.setProtocol(proto);

            console.log(`[NetworkManager] Connected to game world (via proxy) for ${charName}`);
        } catch (err) {
            this.state = 'DISCONNECTED';
            throw err;
        }
    }

    setProtocol(protocol: Protocol): void {
        this.currentProtocol = protocol;
        this.connection.setOnMessage(data => this.currentProtocol?.handlePacket(data));
    }

    disconnect(): void {
        this.connection.disconnect();
        this.state = 'DISCONNECTED';
        this.currentProtocol = null;
    }

    getCurrentProtocol(): Protocol | null {
        return this.currentProtocol;
    }

    isConnected(): boolean {
        return this.connection.isConnected();
    }
}

export const g_networkManager = NetworkManager.getInstance();