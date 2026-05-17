import React, { useState, useEffect, useRef } from 'react';
import { g_networkManager } from '../../network/NetworkManager';

type LoginError =
    | { kind: 'connection'; message: string }
    | { kind: 'auth';       message: string };

interface LoginProps {
    onSuccess: (acc: string, pass: string) => void;
}

const LoginWindow: React.FC<LoginProps> = ({ onSuccess }) => {
    const [account,     setAccount]     = useState('');
    const [password,    setPassword]    = useState('');
    const [loading,     setLoading]     = useState(false);
    const [status,      setStatus]      = useState('');
    const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [error,       setError]       = useState<LoginError | null>(null);

    const accountRef = useRef<HTMLInputElement>(null);

    // Probe WebSocket proxy availability
    useEffect(() => {
        let ws: WebSocket | null = null;
        let timer: ReturnType<typeof setTimeout>;

        const probe = () => {
            if (ws) {
                ws.onopen = ws.onerror = null;
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            }
            
            setServerStatus('checking');
            try {
                ws = new WebSocket('ws://localhost:8081');
                ws.binaryType = 'arraybuffer';
                ws.onopen  = () => { 
                    setServerStatus('online'); 
                    ws?.close(); 
                };
                ws.onerror = () => {
                    setServerStatus('offline');
                };
            } catch {
                setServerStatus('offline');
            }
            timer = setTimeout(probe, 15_000);
        };

        probe();
        return () => { 
            clearTimeout(timer); 
            if (ws) {
                ws.onopen = ws.onerror = null;
                ws.close();
            }
        };
    }, []);

    useEffect(() => {
        console.log('[LoginWindow] Mounted');
        const onError = (e: Event) => {
            const msg = (e as CustomEvent<string>).detail ?? 'Unknown server error';
            console.error('[LoginWindow] Received login_error event:', msg);
            setError({ kind: 'auth', message: msg });
            setLoading(false);
            setStatus('');
        };
        const onSuccessEvent = (e: Event) => {
            const { account: acc, password: pass } = (e as CustomEvent).detail;
            console.log('[LoginWindow] Received login_success event for account:', acc);
            onSuccess(acc, pass);
        };

        window.addEventListener('login_error', onError);
        window.addEventListener('login_success', onSuccessEvent);
        return () => {
            console.log('[LoginWindow] Unmounted');
            window.removeEventListener('login_error', onError);
            window.removeEventListener('login_success', onSuccessEvent);
        };
    }, [onSuccess]);

    const handleLogin = async () => {
        console.log('[LoginWindow] handleLogin clicked. account:', account);
        if (!account.trim() || !password.trim()) {
            setError({ kind: 'auth', message: 'Please fill in account and password.' });
            return;
        }
        setError(null);
        setLoading(true);
        setStatus('Connecting…');
        try {
            console.log('[LoginWindow] Initiating network manager connection...');
            await g_networkManager.connect('ws://localhost:8081', account.trim(), password);
            setStatus('Authenticating…');
        } catch (err: any) {
            console.error('[LoginWindow] Connection failed:', err);
            setError({ kind: 'connection', message: 'Could not connect. Make sure the proxy is running on port 8081.' });
            setLoading(false);
            setStatus('');
        }
    };

    const handleCancel = () => {
        console.log('[LoginWindow] handleCancel clicked. Aborting connection.');
        g_networkManager.disconnect();
        setLoading(false);
        setStatus('');
        setError(null);
    };

    const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !loading) handleLogin(); };

    const dotClass =
        serverStatus === 'online'  ? 'rpg-status-dot rpg-status-dot--online'   :
        serverStatus === 'offline' ? 'rpg-status-dot rpg-status-dot--offline'  :
                                     'rpg-status-dot rpg-status-dot--checking';

    const statusText =
        serverStatus === 'online'  ? 'Server online · localhost:7171' :
        serverStatus === 'offline' ? 'Server offline · Proxy not detected' :
                                     'Checking server status…';

    const errorLabel = {
        connection: 'Connection Error',
        auth:       'Authentication Failed'
    };

    return (
        <div className="rpg-container">
            <div className={`rpg-panel ${loading ? 'rpg-panel--disabled' : ''}`}>
                <div className="rpg-header">
                    <div className="rpg-server-name">Mysera</div>
                    <div className="rpg-title">Enter your account</div>
                </div>

                <div className="rpg-form-area">
                    <div className="rpg-input-group">
                        <label className="rpg-label">Account</label>
                        <input
                            ref={accountRef}
                            className="rpg-input"
                            type="text"
                            value={account}
                            onChange={e => setAccount(e.target.value)}
                            onKeyDown={onKey}
                            disabled={loading}
                            autoComplete="username"
                            placeholder="your account name"
                        />
                    </div>

                    <div className="rpg-input-group">
                        <label className="rpg-label">Password</label>
                        <input
                            className="rpg-input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={onKey}
                            disabled={loading}
                            autoComplete="current-password"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="rpg-error">
                            <span className="rpg-error-icon">⚠</span>
                            <span><strong>{errorLabel[error.kind]}: </strong>{error.message}</span>
                        </div>
                    )}

                    <button className="rpg-button" onClick={handleLogin} disabled={loading}>
                        Enter World
                    </button>
                </div>

                <div className="rpg-status">
                    <span className={dotClass} />
                    <span className="rpg-status-text">{statusText}</span>
                </div>
            </div>

            {/* Modal de Progreso */}
            {loading && (
                <div className="rpg-modal-overlay">
                    <div className="rpg-panel rpg-modal">
                        <div className="rpg-header">
                            <div className="rpg-title">Connecting</div>
                        </div>
                        <div className="rpg-modal-content">
                            <div className="rpg-spinner-large" />
                            <div className="rpg-status-msg">{status}</div>
                            <button className="rpg-button rpg-button--secondary" onClick={handleCancel}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginWindow;