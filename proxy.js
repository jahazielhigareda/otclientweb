/**
 * WebSocket → TCP proxy for OTServ 8.60
 *
 * WHY THIS MATTERS — TCP IS A STREAM, NOT MESSAGES:
 *   The OT protocol uses length-prefixed packets: [uint16 size LE][payload].
 *   TCP may deliver those bytes in arbitrary chunks. If we naïvely forward
 *   every TCP 'data' event as one WebSocket message, the browser may receive
 *   half a packet in one message and the rest in the next — or two packets
 *   merged into one message.
 *
 *   This proxy reassembles the TCP byte stream into complete OT packets before
 *   forwarding each one as a single WebSocket binary message.
 *
 * BROWSER → SERVER:
 *   The browser always sends one complete framed packet per WebSocket message
 *   (Connection.ts does this), so we can forward those directly to TCP.
 */

const WebSocket = require('ws');
const net       = require('net');

const WS_PORT  = 8081;
const TCP_HOST = '127.0.0.1';
const TCP_PORT = 7171;

// ── helpers ──────────────────────────────────────────────────────────────────

function toHex(buf) {
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
}

// ── server ───────────────────────────────────────────────────────────────────

const wss = new WebSocket.Server({ port: WS_PORT }, () => {
    console.log(`[Proxy] WebSocket listening on ws://localhost:${WS_PORT}`);
    console.log(`[Proxy] Forwarding to TCP ${TCP_HOST}:${TCP_PORT}`);
});

wss.on('connection', (ws, req) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const targetPort = parseInt(urlParams.get('port')) || TCP_PORT;
    const targetHost = urlParams.get('host') || TCP_HOST;

    console.log(`[Proxy] Browser connected. Forwarding to ${targetHost}:${targetPort}`);

    // ── TCP receive buffer ───────────────────────────────────────────────────
    // Accumulates raw TCP bytes until we have a complete OT packet.
    let recvBuf = Buffer.alloc(0);

    const tcp = new net.Socket();

    tcp.connect(targetPort, targetHost, () => {
        console.log(`[Proxy] TCP connection established to ${targetHost}:${targetPort}`);
    });

    // ── TCP → WebSocket (with proper framing) ────────────────────────────────
    tcp.on('data', (chunk) => {
        recvBuf = Buffer.concat([recvBuf, chunk]);

        // Parse as many complete OT packets as are available in the buffer.
        // OT packet layout: [uint16 size LE][payload of 'size' bytes]
        // The 'size' field counts only the payload bytes (not itself).
        while (recvBuf.length >= 2) {
            const payloadLen = recvBuf.readUInt16LE(0);
            const totalLen   = 2 + payloadLen; // size field + payload

            if (recvBuf.length < totalLen) break; // wait for more bytes

            // Extract one complete packet and forward it as a WS message.
            const packet = recvBuf.slice(0, totalLen);
            recvBuf      = recvBuf.slice(totalLen);

            console.log(`[Proxy] Server -> Browser (${packet.length} bytes): ${toHex(packet)}`);
            if (ws.readyState === WebSocket.OPEN) ws.send(packet);
        }
    });

    // ── WebSocket → TCP (browser always sends complete frames) ──────────────
    ws.on('message', (data) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        console.log(`[Proxy] Browser -> Server (${buf.length} bytes): ${toHex(buf)}`);
        tcp.write(buf);
    });

    // ── cleanup ──────────────────────────────────────────────────────────────
    ws.on('close', () => {
        console.log('[Proxy] Browser disconnected');
        tcp.destroy();
    });

    ws.on('error', (err) => {
        console.error('[Proxy] WebSocket error:', err.message);
        tcp.destroy();
    });

    tcp.on('error', (err) => {
        console.error('[Proxy] TCP error:', err.message);
        if (ws.readyState === WebSocket.OPEN) ws.close();
    });

    tcp.on('close', () => {
        console.log('[Proxy] TCP connection closed');
        if (ws.readyState === WebSocket.OPEN) ws.close();
    });
});