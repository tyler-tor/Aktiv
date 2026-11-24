import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';
import './Toast.css';

const ToastContext = createContext({ success() {}, error() {} });

// Small confirmation messages ("Route saved"). The container is an aria-live
// region so screen readers announce them without moving focus.
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
    const push = useCallback((type, message) => {
        const id = nextId.current++;
        setToasts((list) => [...list.slice(-2), { id, type, message }]);
        setTimeout(() => dismiss(id), type === 'error' ? 8000 : 4500);
    }, [dismiss]);

    const api = useMemo(() => ({
        success: (message) => push('success', message),
        error: (message) => push('error', message),
    }), [push]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast toast--${toast.type}`}>
                        {toast.type === 'error' ? <FiAlertCircle aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
                        <span>{toast.message}</span>
                        <button type="button" className="icon-btn toast__close" aria-label="Dismiss message" onClick={() => dismiss(toast.id)}>
                            <FiX aria-hidden="true" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
