export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTHENTICATED';

export interface Character {
    name: string;
    world: string;
    ip: string;
    port: number;
    previewState: boolean;
}

export interface TilePosition {
    x: number;
    y: number;
    z: number;
}
