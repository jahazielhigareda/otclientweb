import React, { useState, useEffect } from 'react';
import LoginWindow      from './ui/components/LoginWindow';
import CharSelectWindow from './ui/components/CharSelectWindow';
import GameHUD          from './ui/components/GameHUD';
import LoadingScreen    from './ui/components/LoadingScreen';
import { g_gameManager } from './core/GameManager';
import { g_resourceLoader } from './core/ResourceLoader';
import type { LoadProgress } from './core/ResourceLoader';
import './App.css';

interface Credentials { account: string; password: string; }
type Screen = 'LOADING' | 'LOGIN' | 'CHAR_SELECT' | 'GAME';

export default function App() {
    const [screen,      setScreen]      = useState<Screen>('LOADING');
    const [credentials, setCredentials] = useState<Credentials>({ account: '', password: '' });
    const [motd,        setMotd]        = useState<{ id: string, message: string } | null>(null);
    const [loadProgress, setLoadProgress] = useState<LoadProgress>({
        phase: 'fetch-dat', percent: 0, message: 'Starting...',
    });

    useEffect(() => {
        g_resourceLoader.setOnProgress(setLoadProgress);
        g_resourceLoader.load('/data/things/860');
    }, []);

    useEffect(() => {
        if (loadProgress.phase === 'ready') {
            setScreen('LOGIN');
        }
    }, [loadProgress.phase]);

    useEffect(() => {
        const onLoginSuccess = (e: Event) => {
            const { account, password } = (e as CustomEvent<Credentials>).detail;
            setCredentials({ account, password });
            setScreen('CHAR_SELECT');
        };
        const onCharSelected = () => setScreen('GAME');
        const onMotd = (e: Event) => setMotd((e as CustomEvent).detail);

        window.addEventListener('login_success', onLoginSuccess);
        window.addEventListener('char_selected',  onCharSelected);
        window.addEventListener('motd_received',  onMotd);
        return () => {
            window.removeEventListener('login_success', onLoginSuccess);
            window.removeEventListener('char_selected',  onCharSelected);
            window.removeEventListener('motd_received',  onMotd);
        };
    }, []);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (screen === 'GAME' && canvasRef.current) {
            g_gameManager.init(canvasRef.current);
        }
    }, [screen]);

    if (screen === 'LOADING') {
        return <LoadingScreen progress={loadProgress} />;
    }

    return (
        <>
            {screen === 'LOGIN'       && (
                <LoginWindow 
                    onSuccess={(account, password) => {
                        console.log('[App] Login success callback triggered');
                        setCredentials({ account, password });
                        setScreen('CHAR_SELECT');
                    }} 
                />
            )}
            {screen === 'CHAR_SELECT' && <CharSelectWindow account={credentials.account} password={credentials.password} />}
            {screen === 'GAME'        && (
                <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'black', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, display: 'block', width: '100%', height: '100%', zIndex: 1 }} />
                    <GameHUD />
                </div>
            )}


            {motd && (
                <div className="rpg-modal-overlay">
                    <div className="rpg-panel rpg-modal">
                        <div className="rpg-header">
                            <div className="rpg-title">Message of the Day</div>
                        </div>
                        <div className="rpg-modal-content" style={{ textAlign: 'left' }}>
                            <div style={{ marginBottom: '1.5rem', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                                {motd.message}
                            </div>
                            <button className="rpg-button" onClick={() => setMotd(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}