import React, { useState, useEffect, useRef } from 'react';
import { g_gameManager } from '../../core/GameManager';
import { g_networkManager } from '../../network/NetworkManager';
import { ProtocolGame } from '../../network/protocols/ProtocolGame';

const GameHUD: React.FC = () => {
    const [messages, setMessages] = useState<string[]>(['[System]: Welcome to the Game World!']);
    const [input, setInput] = useState('');
    const [_tick, setTick] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onText = (e: Event) => {
            const { message } = (e as CustomEvent).detail;
            setMessages(prev => [...prev, message]);
        };
        window.addEventListener('game_text_message', onText);
        return () => window.removeEventListener('game_text_message', onText);
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const interval = setInterval(() => setTick(n => n + 1), 200);
        return () => clearInterval(interval);
    }, []);

    const { player } = g_gameManager;

    const handleSend = () => {
        if (!input.trim()) return;
        const proto = g_networkManager.getCurrentProtocol();
        if (proto instanceof ProtocolGame) {
            proto.sendTalk(input.trim());
        }
        setMessages(prev => [...prev, `[You]: ${input.trim()}`]);
        setInput('');
    };

    const hpPct = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
    const manaPct = player.maxMana > 0 ? (player.mana / player.maxMana) * 100 : 0;

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', color: '#fff', fontFamily: 'serif' }}>
            {/* Status Bars */}
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
                    <div style={{ width: '100%', height: '14px', backgroundColor: '#004', border: '1px solid #008', borderRadius: '2px', overflow: 'hidden' }}>
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
