import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { Modal } from './common/Modal.jsx';
import { getSettings } from '../services/storage.js';
import { setReducedMotion } from '../services/settings.js';
import './settings.css';

const isSettingsModalOpen = signal(false);

export function openSettingsModal() {
    isSettingsModalOpen.value = true;
}

function SettingsModal({ isOpen, onClose }) {
    const [reducedMotion, setReducedMotionState] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setReducedMotionState(!!getSettings().reducedMotion);
        }
    }, [isOpen]);

    function handleToggle() {
        const next = !reducedMotion;
        setReducedMotionState(next);
        setReducedMotion(next);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" theme="main" className="settings-modal">
            <div className="settings-body">
                <button
                    type="button"
                    className="settings-row settings-checkbox-row"
                    onClick={handleToggle}
                    role="switch"
                    aria-checked={reducedMotion}
                    data-testid="reduced-motion-toggle"
                >
                    <span className="settings-label">Reduced Motion</span>
                    <span className={`settings-checkbox ${reducedMotion ? 'checked' : ''}`} aria-hidden="true">
                        {reducedMotion && <span className="settings-checkbox-mark">✓</span>}
                    </span>
                </button>
                <div className="settings-version">v{import.meta.env.APP_VERSION}</div>
            </div>
        </Modal>
    );
}

export function SettingsModalContainer() {
    return (
        <SettingsModal
            isOpen={isSettingsModalOpen.value}
            onClose={() => isSettingsModalOpen.value = false}
        />
    );
}
