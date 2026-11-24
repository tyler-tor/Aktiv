import React, { useState } from 'react';

// Content of a confirm dialog (rendered inside <Modal>). `onConfirm` may be
// async and may return a list of error strings to show.
export default function ConfirmForm({ title, message, confirmLabel, danger = false, onConfirm, onClose }) {
    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState([]);

    const confirm = async () => {
        setBusy(true);
        const result = await onConfirm();
        if (Array.isArray(result) && result.length) {
            setErrors(result);
            setBusy(false);
        }
    };

    return (
        <div className="dialog dialog--confirm">
            <h2 className="dialog__title">{title}</h2>
            <p className="dialog__text">{message}</p>
            <div className="form-errors" role="alert">
                {errors.map((error, i) => <p className="form-error" key={i}>{error}</p>)}
            </div>
            <div className="btn-row dialog__actions">
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
                <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={confirm} disabled={busy}>
                    {busy ? 'Working...' : confirmLabel}
                </button>
            </div>
        </div>
    );
}
