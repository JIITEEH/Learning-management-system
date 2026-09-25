// Short messages that appear in the corner and fade away ("Saved.", "Could not save").
// Any screen shows one with: const toast = useToast(); toast.success('Saved.');
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

const ToastContext = createContext(null);
const TOAST_DURATION = 6000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const show = useCallback((tone, message) => {
    const id = nextId.current++;
    // At most four on screen; the oldest goes first
    setToasts((list) => [...list.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), TOAST_DURATION);
  }, []);

  const value = useMemo(
    () => ({
      success: (message) => show('ok', message),
      error: (message) => show('error', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* "polite": a screen reader finishes its sentence before reading the message */}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'ok' ? CircleCheck : CircleAlert;
          return (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              <Icon aria-hidden="true" />
              <span className="toast-text">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
