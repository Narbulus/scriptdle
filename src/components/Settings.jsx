import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { Modal } from './common/Modal.jsx';
import { getSettings } from '../services/storage.js';
import { setReducedMotion } from '../services/settings.js';
import { isSoundEnabled, setSoundEnabled, playTick } from '../utils/sound.js';
import './settings.css';

const isSettingsModalOpen = signal(false);

export function openSettingsModal() {
    isSettingsModalOpen.value = true;
}

function SettingsModal({ isOpen, onClose }) {
    const [reducedMotion, setReducedMotionState] = useState(false);
    const [soundEnabled, setSoundEnabledState] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setReducedMotionState(!!getSettings().reducedMotion);
            setSoundEnabledState(isSoundEnabled());
        }
    }, [isOpen]);

    function handleToggleReducedMotion() {
        const next = !reducedMotion;
        setReducedMotionState(next);
        setReducedMotion(next);
    }

    function handleToggleSound() {
        const next = !soundEnabled;
        setSoundEnabledState(next);
        setSoundEnabled(next);
        if (next) {
            playTick();
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" theme="main" className="settings-modal">
            <div className="settings-body">
                <button
                    type="button"
                    className="settings-row settings-checkbox-row"
                    onClick={handleToggleSound}
                    role="switch"
                    aria-checked={soundEnabled}
                    data-testid="sound-effects-toggle"
                >
                    <span className="settings-label">Sound Effects</span>
                    <span className={`settings-checkbox ${soundEnabled ? 'checked' : ''}`} aria-hidden="true">
                        {soundEnabled && <span className="settings-checkbox-mark">✓</span>}
                    </span>
                </button>
                <button
                    type="button"
                    className="settings-row settings-checkbox-row"
                    onClick={handleToggleReducedMotion}
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
