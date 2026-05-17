---
phase: "05-game-protocol"
plan: "03"
type: "execute"
wave: 3
depends_on: ["05-game-protocol-02"]
files_modified:
  - "client/src/core/GameManager.ts"
  - "client/src/network/protocols/ProtocolGame.ts"
  - "client/src/ui/components/GameHUD.tsx"
  - "client/src/core/GameLoop.ts"
autonomous: false
must_haves:
  truths:
    - "Pressing WASD sends movement commands to the server"
    - "Server text messages appear in the chat window"
    - "Player can type and send chat messages"
    - "HP/mana bars update in real-time from server data"
    - "Connection stays alive via ping/pong heartbeat"
    - "Player name/level appear in HUD"
  artifacts:
    - path: "client/src/network/protocols/ProtocolGame.ts"
      provides: "sendWalk*() and sendTalk() methods"
      min_lines: 400
    - path: "client/src/ui/components/GameHUD.tsx"
      provides: "Live HP/mana bars, chat messages, player info"
      min_lines: 100
  key_links:
    - from: "GameHUD"
      to: "g_gameManager.player"
      via: "useState + useEffect on interval"
      pattern: "g_gameManager\\.player\\."
    - from: "ProtocolGame.parseTextMessage"
      to: "window customEvent"
      via: "dispatchEvent"
      pattern: "text_message_received"
    - from: "GameHUD"
      to: "chat send"
      via: "ProtocolGame.sendTalk()"
      pattern: "g_networkManager\\.currentProtocol"
---

<objective>
Enable player interactions with the game world: WASD movement via server commands, chat send/receive, live HUD updates from real HP/mana, and connection heartbeat.

**Purpose:** Without these features, the player can't actually play — movement is local-only (pixel pushing), chat doesn't work, and the connection drops from inactivity. This plan makes the game interactive.

**Output:** Network-based WASD movement, working chat (send + receive), live HUD bound to server player state, and ping/pong heartbeat for connection stability.
</objective>

<context>
@.planning/5-01-PLAN.md
@.planning/5-02-PLAN.md
@client/src/core/GameManager.ts
@client/src/core/GameLoop.ts
@client/src/ui/components/GameHUD.tsx
@client/src/network/protocols/ProtocolGame.ts
@client/src/App.tsx

**Current GameHUD state:** Static bars showing hardcoded 100/100 and 50/50, chat with placeholder system messages, input field with no send functionality.

**Current GameManager state:** Has handleInput() with local-only pixel movement (speed=5). No network movement.

**Current GameLoop state:** Calls `g_gameManager.update()` each frame. No heartbeat mechanism.
</context>

<tasks>

<task type="auto">
  <name>task 1: Implement network movement commands and heartbeat</name>
  <files>
    client/src/core/GameManager.ts
    client/src/network/protocols/ProtocolGame.ts
    client/src/core/GameLoop.ts
  </files>
  <action>
    **A) Add sendWalk* methods to ProtocolGame:**

    Add these methods using the correct ClientOpcodes from ProtocolCodes.ts:
    ```typescript
    sendWalkNorth(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientWalkNorth); // 101
        this.sendPacket(packet);
    }
    sendWalkEast(): void  { /* ClientWalkEast = 102 */ }
    sendWalkSouth(): void { /* ClientWalkSouth = 103 */ }
    sendWalkWest(): void  { /* ClientWalkWest = 104 */ }
    sendStop(): void      { /* ClientStop = 105 */ }
    ```

    **B) Refactor GameManager.handleInput() to send network commands:**
    
    Replace the local pixel-movement with network sends. The new handler should:
    ```typescript
    private handleInput(e: KeyboardEvent): void {
        const proto = g_networkManager.getCurrentProtocol();
        if (!(proto instanceof ProtocolGame)) return;
        
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup':    proto.sendWalkNorth(); break;
            case 's': case 'arrowdown':  proto.sendWalkSouth(); break;
            case 'a': case 'arrowleft':  proto.sendWalkWest(); break;
            case 'd': case 'arrowright': proto.sendWalkEast(); break;
        }
    }
    ```
    
    This requires exposing `getCurrentProtocol()` on NetworkManager:
    ```typescript
    getCurrentProtocol(): Protocol | null { return this.currentProtocol; }
    ```
    
    Also import ProtocolGame in GameManager:
    ```typescript
    import { ProtocolGame } from '../network/protocols/ProtocolGame';
    ```

    **C) Add heartbeat to GameLoop:**
    
    The OT server sends `GameServerPing (0x1E)` periodically. The client must respond with `ClientPingBack (0x1E)`. This is already handled in plan 5-01 (task 2) where we add the Ping case to processPacket.

    Additionally, add a periodic keepalive in GameLoop:
    ```typescript
    private lastPingCheck: number = 0;
    
    private loop = (): void => {
        if (!this.running) return;
        g_dispatcher.poll();
        g_gameManager.update();
        
        // Check for heartbeat every 10 seconds
        const now = performance.now();
        if (now - this.lastPingCheck > 10000) {
            this.lastPingCheck = now;
            // Ping check is handled server-side — server sends ping, we respond
            // No need to send extra pings
        }
        
        requestAnimationFrame(this.loop);
    }
    ```
    
    Add a `setPingBack()` method to ProtocolGame if not already added:
    ```typescript
    sendPingBack(): void {
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientPingBack); // 0x1D = 29
        this.sendPacket(packet);
    }
    ```
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr "error" | head -10</automated>
  </verify>
  <done>
    WASD keys send walk opcodes via ProtocolGame; GameManager no longer has local-only pixel movement; NetworkManager exposes getCurrentProtocol; TypeScript compiles
  </done>
</task>

<task type="auto">
  <name>task 2: Implement chat send/receive and text message HUD integration</name>
  <files>
    client/src/network/protocols/ProtocolGame.ts
    client/src/ui/components/GameHUD.tsx
    client/src/App.tsx
  </files>
  <action>
    **A) Add sendTalk() to ProtocolGame:**
    ```typescript
    sendTalk(message: string): void {
        if (!message.trim()) return;
        const packet = new Packet();
        packet.writeUint8(ClientOpcodes.ClientTalk); // 150 = 0x96
        packet.writeUint8(1); // MessageMode: SpeakNormal = 1
        packet.writeString(message);
        this.sendPacket(packet);
    }
    ```

    **B) Wire text message parsing to events:**
    
    In ProtocolGame.processPacket, `GameServerTextMessage (0xB4 / 180)`:
    ```typescript
    case GameServerOpcodes.GameServerTextMessage: {
        const msgType = packet.readUint8(); // MessageMode
        const message = packet.readString(); // The text
        console.log(`[Chat] ${message}`);
        window.dispatchEvent(new CustomEvent('game_text_message', {
            detail: { type: msgType, message }
        }));
        break;
    }
    ```
    
    In 8.60, TextMessage format is simply: [u8 type][string message]

    **C) Refactor GameHUD to display live messages and enable sending:**
    
    ```typescript
    import React, { useState, useEffect, useRef } from 'react';
    import { g_gameManager } from '../../core/GameManager';
    import { g_networkManager } from '../../network/NetworkManager';
    import { ProtocolGame } from '../../network/protocols/ProtocolGame';
    
    const GameHUD: React.FC = () => {
        const { player } = g_gameManager;
        const [messages, setMessages] = useState<string[]>([
            '[System]: Welcome to the Game World!'
        ]);
        const [input, setInput] = useState('');
        const chatEndRef = useRef<HTMLDivElement>(null);
        
        // Listen for server text messages
        useEffect(() => {
            const onText = (e: Event) => {
                const { message } = (e as CustomEvent).detail;
                setMessages(prev => [...prev, message]);
            };
            window.addEventListener('game_text_message', onText);
            return () => window.removeEventListener('game_text_message', onText);
        }, []);
        
        // Auto-scroll chat
        useEffect(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, [messages]);
        
        const handleSend = () => {
            if (!input.trim()) return;
            const proto = g_networkManager.getCurrentProtocol();
            if (proto instanceof ProtocolGame) {
                proto.sendTalk(input.trim());
            }
            setMessages(prev => [...prev, `[You]: ${input.trim()}`]);
            setInput('');
        };
        
        // Poll player stats for live HUD updates
        const [, forceUpdate] = useState(0);
        useEffect(() => {
            const interval = setInterval(() => forceUpdate(n => n + 1), 200);
            return () => clearInterval(interval);
        }, []);
        
        const hpPct = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
        const manaPct = player.maxMana > 0 ? (player.mana / player.maxMana) * 100 : 0;
        
        return (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', color: '#fff', fontFamily: 'serif' }}>
                {/* HP Bar */}
                <div style={{ position: 'absolute', top: '20px', left: '20px', width: '220px' }}>
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.85em', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>HP</span>
                            <span>{player.hp}/{player.maxHp}</span>
                        </div>
                        <div style={{ width: '100%', height: '14px', backgroundColor: '#400', border: '1px solid #800', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${hpPct}%`, height: '100%', backgroundColor: '#c02020', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.85em', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>MANA</span>
                            <span>{player.mana}/{player.maxMana}</span>
                        </div>
                        <div style={{ width: '100%', height: '14px', backgroundColor: '#004', border: '1px solid '#008', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${manaPct}%`, height: '100%', backgroundColor: '#2040c0', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                    {player.level > 0 && (
                        <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#c9a227' }}>
                            Level {player.level}
                        </div>
                    )}
                </div>
                
                {/* Chat */}
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '420px', height: '180px', backgroundColor: 'rgba(0,0,0,0.7)', border: '1px solid #555', borderRadius: '4px', display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px', fontSize: '0.85em' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ marginBottom: '2px', color: msg.startsWith('[You]') ? '#c9a227' : '#e8dfc8' }}>
                                {msg}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div style={{ display: 'flex', borderTop: '1px solid #444' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                            placeholder="Type a message..."
                            style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: '#fff', padding: '8px', outline: 'none', fontFamily: 'serif', fontSize: '0.85em' }}
                        />
                    </div>
                </div>
            </div>
        );
    };
    
    export default GameHUD;
    ```

    Fix the template literal syntax issue in the JSX: the border `'#008'` should use backtick template literals properly. Actually use `${'#008'}` or just `#008` directly as a string in the style object.
  </action>
  <verify>
    <automated>npx tsc -b --noEmit 2>&1 | findstr /V "node_modules" | findstr "error" | head -10</automated>
  </verify>
  <done>
    Chat messages from server appear in GameHUD; player can type and send messages; HP/mana bars show real server values updated every 200ms; TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>task 3: Verify full game flow — connect, move, chat</name>
  <files>
    client/src/core/GameManager.ts
    client/src/network/protocols/ProtocolGame.ts
    client/src/ui/components/GameHUD.tsx
  </files>
  <what-built>
    Complete game protocol integration:
    1. WASD sends network movement commands (not local pixel push)
    2. Chat messages appear in HUD from server
    3. Player can send chat messages
    4. HP/mana bars show real-time server values
    5. Connection stays alive with ping/pong heartbeat
  </what-built>
  <how-to-verify>
    1. Start the proxy: `node proxy.js` in C:\git\OTClientWeb
    2. Start the dev server: `npx vite` in C:\git\OTClientWeb\client
    3. Open http://localhost:5173 (or whatever Vite says)
    4. Login with your account credentials
    5. Select your character and click "Enter World"
    6. In the game screen:
       - [ ] No console error spam of "unhandled opcode" (maybe a few unknown ones, not repeated)
       - [ ] Canvas shows tiles/ground (not just a grid)
       - [ ] Your character appears on the map (blue or red dot with name)
       - [ ] HP bar shows your character's actual HP
       - [ ] Mana bar shows your character's actual mana
       - [ ] Level is displayed if available
       - [ ] Press W/A/S/D — character moves in-game
       - [ ] Server messages appear in chat window
       - [ ] Type a message and press Enter — it sends to server
       - [ ] Bars update when HP/mana changes
  </how-to-verify>
  <resume-signal>Type "approved" to sign off, or describe any issues found for iteration</resume-signal>
</task>

</tasks>

<verification>
1. `npx tsc -b --noEmit` — no TypeScript errors
2. Manual gameplay test (see checkpoint task 3)
3. Console logs show clean protocol parsing, no desync loops
</verification>

<success_criteria>
- WASD keys send network movement commands (not local pixel movement)
- Chat messages from server appear in HUD in real-time
- Chat input field sends messages to server via sendTalk()
- HP/mana bars display current server values with animated transitions
- Player level is displayed in HUD if available
- Connection stays active — no timeout from missing heartbeats
- No "unhandled opcode" desync loops in console
</success_criteria>
