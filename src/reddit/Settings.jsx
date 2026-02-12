import { signal } from '@preact/signals';
import { useState, useEffect } from 'preact/hooks';
import { Modal } from '../components/common/Modal.jsx';
import { getSettings, saveSettings } from '../services/storage.js';

const isSettingsModalOpen = signal(false);

export function openSettingsModal() {
    isSettingsModalOpen.value = true;
}

function SettingsModal({ isOpen, onClose }) {
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setReducedMotion(!!getSettings().reducedMotion);
        }
    }, [isOpen]);

    function handleToggle() {
        const next = !reducedMotion;
        setReducedMotion(next);
        saveSettings({ ...getSettings(), reducedMotion: next });
        if (next) {
            document.documentElement.setAttribute('data-reduced-motion', '');
        } else {
            document.documentElement.removeAttribute('data-reduced-motion');
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" theme="pack">
            <div className="settings-body">
                <div className="settings-row settings-checkbox-row" onClick={handleToggle}>
                    <span className="settings-label">Reduced Motion</span>
                    <span className={`settings-checkbox ${reducedMotion ? 'checked' : ''}`} aria-hidden="true">
                        {reducedMotion && <span className="settings-checkbox-mark">✓</span>}
                    </span>
                </div>
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
