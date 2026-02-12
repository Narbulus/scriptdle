import { useState, useEffect } from 'preact/hooks';
import { currentPackId, currentPuzzleDate, initGame } from '../../services/game-state.js';
import { getStorageBackend, saveTutorialState, clearAllData } from '../../services/storage.js';

const btnStyle = {
    width: '100%',
    padding: '8px',
    background: '#0f0',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    marginBottom: '4px'
};

export function DebugMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState(null);
    const [wipeConfirm, setWipeConfirm] = useState(false);

    // Toggle with Ctrl+Shift+D or Cmd+Shift+D
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Reset wipe confirm when menu closes
    useEffect(() => {
        if (!isOpen) setWipeConfirm(false);
    }, [isOpen]);

    const showStatus = (msg) => {
        setStatus(msg);
        setTimeout(() => setStatus(null), 3000);
    };

    const clearCurrentGame = () => {
        const packId = currentPackId.value;
        const date = currentPuzzleDate.value;

        if (!packId || !date) {
            showStatus('No active game to clear');
            return;
        }

        const key = `scriptle:${packId}:${date}`;
        const backend = getStorageBackend();
        backend.setItem(key, null);
        localStorage.removeItem(key);
        initGame(packId, date);

        showStatus(`Cleared ${packId} / ${date}`);
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <div
                style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#0f0',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    zIndex: 9999,
                    fontFamily: 'monospace'
                }}
                onClick={() => setIsOpen(true)}
            >
                DEBUG
            </div>
        );
    }

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.9)',
                color: '#0f0',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                zIndex: 9999,
                fontFamily: 'monospace',
                border: '1px solid #0f0',
                minWidth: '200px'
            }}
        >
            <div style={{ marginBottom: '8px', fontWeight: 'bold', borderBottom: '1px solid #0f0', paddingBottom: '4px' }}>
                Debug Menu
            </div>
            {status && (
                <div style={{ padding: '6px', marginBottom: '4px', background: '#333', color: '#0f0', borderRadius: '4px', fontSize: '10px', textAlign: 'center' }}>
                    {status}
                </div>
            )}
            <button
                onClick={() => {
                    saveTutorialState({ step: 1, completed: false });
                    showStatus('Tutorial cleared — reload to see it');
                }}
                style={btnStyle}
            >
                Clear Tutorial State
            </button>
            <button
                onClick={clearCurrentGame}
                style={btnStyle}
            >
                Clear Current Game
            </button>
            {!wipeConfirm ? (
                <button
                    onClick={() => setWipeConfirm(true)}
                    style={{ ...btnStyle, background: '#f00', color: '#fff' }}
                >
                    Wipe All Data
                </button>
            ) : (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    <button
                        onClick={() => {
                            clearAllData();
                            showStatus('All data wiped. Reloading...');
                            setTimeout(() => window.location.reload(), 500);
                        }}
                        style={{ ...btnStyle, background: '#f00', color: '#fff', flex: 1, marginBottom: 0 }}
                    >
                        Confirm Wipe
                    </button>
                    <button
                        onClick={() => setWipeConfirm(false)}
                        style={{ ...btnStyle, background: '#555', color: '#fff', flex: 1, marginBottom: 0 }}
                    >
                        Cancel
                    </button>
                </div>
            )}
            <button
                onClick={() => setIsOpen(false)}
                style={{
                    width: '100%',
                    padding: '4px',
                    background: 'transparent',
                    color: '#0f0',
                    border: '1px solid #0f0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px'
                }}
            >
                Close (Ctrl+Shift+D)
            </button>
        </div>
    );
}
