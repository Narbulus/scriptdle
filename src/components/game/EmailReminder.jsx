import { useState } from 'preact/hooks';
import { getStorageBackend } from '../../services/storage.js';
import { track } from '../../utils/analytics.js';

const SUBS_STORAGE_KEY = 'scriptle_email_subs';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function readSavedSub(packId) {
    try {
        const raw = getStorageBackend().getItem(SUBS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed[packId] || null;
    } catch {
        return null;
    }
}

function writeSavedSub(packId, email) {
    try {
        const backend = getStorageBackend();
        const raw = backend.getItem(SUBS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[packId] = email;
        backend.setItem(SUBS_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
        // Ignore storage write errors (private browsing, etc.)
    }
}

export function EmailReminder({ pack }) {
    const [savedEmail, setSavedEmail] = useState(() => readSavedSub(pack.id));
    const [email, setEmail] = useState(savedEmail || '');
    const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'error'
    const [errorMsg, setErrorMsg] = useState('');

    if (savedEmail && status !== 'editing') {
        return (
            <div className="email-reminder is-subscribed" data-testid="email-reminder">
                <span className="email-reminder-confirmed">
                    ✓ Tomorrow&apos;s {pack.name} quote &rarr; <strong>{savedEmail}</strong>
                </span>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!EMAIL_RE.test(trimmed)) {
            setStatus('error');
            setErrorMsg('Enter a valid email address.');
            return;
        }

        setStatus('submitting');
        setErrorMsg('');

        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: trimmed,
                    packId: pack.id,
                    packName: pack.name,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Could not save reminder right now.');
            }
            writeSavedSub(pack.id, trimmed);
            setSavedEmail(trimmed);
            setStatus('idle');
            track('email_subscribe', { pack_id: pack.id });
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message || 'Could not save reminder right now.');
        }
    };

    return (
        <form className="email-reminder" data-testid="email-reminder" onSubmit={handleSubmit} noValidate>
            <div className="email-reminder-label">
                Get tomorrow&apos;s {pack.name} quote in your inbox
            </div>
            <div className="email-reminder-row">
                <input
                    type="email"
                    className="email-reminder-input"
                    data-testid="email-reminder-input"
                    value={email}
                    onInput={(e) => {
                        setEmail(e.currentTarget.value);
                        if (status === 'error') {
                            setStatus('idle');
                            setErrorMsg('');
                        }
                    }}
                    placeholder="you@email.com"
                    aria-label={`Email for daily ${pack.name} quote`}
                    autocomplete="email"
                    disabled={status === 'submitting'}
                />
                <button
                    type="submit"
                    className="email-reminder-btn"
                    data-testid="email-reminder-submit"
                    disabled={status === 'submitting'}
                >
                    {status === 'submitting' ? 'Saving…' : 'Send Daily'}
                </button>
            </div>
            {errorMsg && (
                <div className="email-reminder-error" role="alert" data-testid="email-reminder-error">
                    {errorMsg}
                </div>
            )}
        </form>
    );
}
