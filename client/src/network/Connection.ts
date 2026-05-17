import { Packet } from './Packet';

export class Connection {
    private socket: WebSocket | null = null;
    public state: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' = 'DISCONNECTED';

    connect(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.state = 'CONNECTING';
            this.socket = new WebSocket(url);
            this.socket.binaryType = 'arraybuffer';

            this.socket.onopen = () => {
                this.state = 'CONNECTED';
                console.log("[Connection] Opened");
                resolve();
            };

            this.socket.onerror = (err) => {
                this.state = 'DISCONNECTED';
                reject(err);
            };

            this.socket.onclose = (event: CloseEvent) => {
                this.state = 'DISCONNECTED';
                console.log(`[Connection] Closed code=${event.code} reason="${event.reason}" wasClean=${event.wasClean}`);
            };
        });
    }

    send(data: Uint8Array): void {
        if (!this.socket) return;
        this.socket.send(data);
    }

    sendFramedPacket(data: Uint8Array): void {
        if (!this.socket) return;
        
        const framed = new Uint8Array(6 + data.length);
        const view = new DataView(framed.buffer);
        
        // bytes 0-1: size (payload + checksum)
        view.setUint16(0, data.length + 4, true);
        
        // bytes 2-5: checksum
        const checksum = Packet.calculateAdler32(data);
        view.setUint32(2, checksum, true);
        
        // payload starts at byte 6
        framed.set(data, 6);
        
        this.socket.send(framed);
    }


    setOnMessage(callback: (data: ArrayBuffer) => void): void {
        if (this.socket) {
            this.socket.onmessage = (event) => callback(event.data);
        }
    }

    disconnect(): void {
        this.socket?.close();
        this.state = 'DISCONNECTED';
    }

    isConnected(): boolean {
        return this.state === 'CONNECTED';
    }
}
