import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'success' | 'danger' | 'info';
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

const ToastContext = createContext<((t: Omit<Toast, 'id'>) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.tone === 'danger' ? 7000 : 4000);
    },
    [dismiss],
  );
  const icon = { success: <CircleCheck className="text-success" />, danger: <CircleAlert className="text-danger" />, info: <Info className="text-info" /> };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'danger' ? 'alert' : 'status'} className="pointer-events-auto flex animate-slide-in gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-pop [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0">
            {icon[t.tone]}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-muted">{t.description}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className={cn('-mr-1 self-start rounded p-0.5 text-muted hover:text-ink')} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside ToastProvider');
  return useMemo(
    () => ({
      success: (title: string, description?: string) => push({ tone: 'success', title, description }),
      error: (title: string, description?: string) => push({ tone: 'danger', title, description }),
      info: (title: string, description?: string) => push({ tone: 'info', title, description }),
    }),
    [push],
  );
}
