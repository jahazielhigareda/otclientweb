import React, { useState, useEffect } from 'react';
import { g_networkManager } from '../../network/NetworkManager';
import type { Character } from '../../network/types';

interface CharSelectProps {
    account:  string;
    password: string;
}

const CharSelectWindow: React.FC<CharSelectProps> = ({ account, password }) => {
    const [characters,  setCharacters]  = useState<Character[]>([]);
    const [selected,    setSelected]    = useState<Character | null>(null);
    const [premiumDays, setPremiumDays] = useState(0);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState('');

    useEffect(() => {
        console.log('[CharSelectWindow] Mounted');
        const onList = (e: Event) => {
            const { characters: chars, premiumDays: days } = (e as CustomEvent).detail;
            console.log('[CharSelectWindow] Received char_list_received event. Count:', chars?.length);
            setCharacters(chars || []);
            setPremiumDays(days || 0);
        };
        window.addEventListener('char_list_received', onList);
        return () => {
            console.log('[CharSelectWindow] Unmounted');
            window.removeEventListener('char_list_received', onList);
        };
    }, []);

    const handleEnterGame = async () => {
        if (!selected) return;
        console.log('[CharSelectWindow] handleEnterGame clicked for character:', selected.name);
        setError('');
        setLoading(true);
        try {
            console.log('[CharSelectWindow] Disconnecting from login and connecting to game server...');
            g_networkManager.disconnect();
            await g_networkManager.connectGameWorld(
                selected.ip, selected.port, account, password, selected.name
            );
            console.log('[CharSelectWindow] Game connection established.');
            window.dispatchEvent(new CustomEvent('char_selected'));
        } catch (err: any) {
            console.error('[CharSelectWindow] Game connection failed:', err);
            setError('Could not connect to the game server. Try again.');
            setLoading(false);
        }
    };

    const onCharClick = (char: Character) => {
        console.log('[CharSelectWindow] Selected character:', char.name);
        setSelected(char);
    };

    return (
        <div className="rpg-container">
            <div className="rpg-panel rpg-panel--wide">
                <div className="rpg-header">
                    <div className="rpg-server-name">Mysera</div>
                    <div className="rpg-title">Choose your character</div>
                </div>

                <div className="rpg-form-area">
                    {premiumDays > 0 && (
                        <div className="rpg-premium">
                            ★ Premium account · {premiumDays} days remaining
                        </div>
                    )}

                    <div className="rpg-char-list">
                        {characters.length === 0 ? (
                            <div className="rpg-empty">No characters found on this account.</div>
                        ) : characters.map(char => (
                            <div
                                key={char.name}
                                className={`rpg-char-item${selected?.name === char.name ? ' selected' : ''}`}
                                onClick={() => onCharClick(char)}
                            >
                                <span className="rpg-char-name">{char.name}</span>
                                <span className="rpg-char-meta">
                                    <span className="rpg-char-world">{char.world}</span>
                                    <span>{char.ip}:{char.port}</span>
                                </span>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="rpg-error">
                            <span className="rpg-error-icon">⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        className="rpg-button"
                        onClick={handleEnterGame}
                        disabled={!selected || loading}
                    >
                        {loading && <span className="rpg-spinner" />}
                        {loading ? 'Connecting…' : 'Enter World'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CharSelectWindow;