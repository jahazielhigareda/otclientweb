import { Connection } from './Connection';

export abstract class Protocol {
    protected connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    abstract handlePacket(data: ArrayBuffer): void;
}
