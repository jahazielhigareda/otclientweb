import { SpritesFile } from './SpritesFile';
import { DatFile } from './DatFile';

export type LoadProgress = {
    phase: 'fetch-dat' | 'parse-dat' | 'fetch-spr' | 'parse-spr' | 'ready' | 'error';
    percent: number;
    message: string;
    error?: string;
};

export type ProgressCallback = (progress: LoadProgress) => void;

export class ResourceLoader {
    private sprites: SpritesFile | null = null;
    private dat: DatFile | null = null;
    private onProgress: ProgressCallback | null = null;

    setOnProgress(cb: ProgressCallback): void {
        this.onProgress = cb;
    }

    getSprites(): SpritesFile | null {
        return this.sprites;
    }

    getDat(): DatFile | null {
        if (!this.dat) {
            // console.error('[ResourceLoader] getDat called but dat is null!');
        }
        return this.dat;
    }

    private emit(p: LoadProgress): void {
        this.onProgress?.(p);
    }

    async load(basePath: string, clientVersion: number = 860): Promise<void> {
        try {
            this.emit({ phase: 'fetch-dat', percent: 0, message: 'Downloading Tibia.dat...' });
            const datResponse = await fetch(`${basePath}/Tibia.dat`);
            const contentLength = datResponse.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength) : 0;

            if (total > 0 && datResponse.body) {
                const reader = datResponse.body.getReader();
                const chunks: Uint8Array[] = [];
                let received = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;
                    const pct = Math.min(15, Math.round((received / total) * 15));
                    this.emit({ phase: 'fetch-dat', percent: pct, message: `Downloading Tibia.dat... ${received}/${total}` });
                }
                const blob = new Blob(chunks as any);
                const buf = await blob.arrayBuffer();
                this.emit({ phase: 'parse-dat', percent: 16, message: 'Parsing Tibia.dat...' });
                this.dat = await DatFile.loadFromBuffer(buf, clientVersion);
            } else {
                const buf = await datResponse.arrayBuffer();
                this.emit({ phase: 'parse-dat', percent: 16, message: 'Parsing Tibia.dat...' });
                this.dat = await DatFile.loadFromBuffer(buf, clientVersion);
            }

            this.emit({ phase: 'parse-dat', percent: 20, message: `Tibia.dat loaded (${this.dat.getItems().length} items)` });

            this.emit({ phase: 'fetch-spr', percent: 21, message: 'Downloading Tibia.spr...' });
            const sprResponse = await fetch(`${basePath}/Tibia.spr`);
            const sprLength = sprResponse.headers.get('content-length');
            const sprTotal = sprLength ? parseInt(sprLength) : 0;

            if (sprTotal > 0 && sprResponse.body) {
                const reader = sprResponse.body.getReader();
                const chunks: Uint8Array[] = [];
                let received = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;
                    const pct = 21 + Math.round((received / sprTotal) * 74);
                    this.emit({ phase: 'fetch-spr', percent: pct, message: `Downloading Tibia.spr... ${received}/${sprTotal}` });
                }
                const blob = new Blob(chunks as any);
                const buf = await blob.arrayBuffer();
                this.emit({ phase: 'parse-spr', percent: 96, message: 'Parsing Tibia.spr...' });
                this.sprites = await SpritesFile.loadFromBuffer(buf, clientVersion);
            } else {
                const buf = await sprResponse.arrayBuffer();
                this.emit({ phase: 'parse-spr', percent: 96, message: 'Parsing Tibia.spr...' });
                this.sprites = await SpritesFile.loadFromBuffer(buf, clientVersion);
            }

            this.emit({ phase: 'ready', percent: 100, message: `Ready! ${this.sprites.count} sprites loaded` });
        } catch (err: any) {
            this.emit({ phase: 'error', percent: 0, message: err.message, error: err.message });
        }
    }
}

export const g_resourceLoader = new ResourceLoader();
