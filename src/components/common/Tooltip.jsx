import './tooltip.css';

export function TutorialTip({ children, onClose, show, caretPosition = 'center' }) {
    if (!show) return null;

    return (
        <div className={`tutorial-tip tutorial-tip-caret-${caretPosition}`}>
            <div className="tutorial-tip-content">{children}</div>
            <button className="tutorial-tip-close" onClick={onClose} aria-label="Dismiss tip">&times;</button>
        </div>
    );
}
