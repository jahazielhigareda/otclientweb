import React from 'react';
import type { LoadProgress } from '../../core/ResourceLoader';

interface Props {
    progress: LoadProgress;
}

const LoadingScreen: React.FC<Props> = ({ progress }) => {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', fontFamily: 'serif', color: '#c9a227',
        }}>
            <div style={{ fontSize: '1.5em', marginBottom: '24px', letterSpacing: '2px' }}>
                OTClientWeb
            </div>
            <div style={{
                width: '300px', height: '16px', backgroundColor: '#222',
                border: '1px solid #555', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px',
            }}>
                <div style={{
                    width: `${Math.max(1, progress.percent)}%`,
                    height: '100%',
                    backgroundColor: progress.phase === 'error' ? '#c02020' : '#c9a227',
                    transition: 'width 0.3s ease',
                }} />
            </div>
            <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                {progress.message}
            </div>
        </div>
    );
};

export default LoadingScreen;
