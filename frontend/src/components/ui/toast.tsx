'use client';

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Toast as ToastPrimitive } from 'radix-ui';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

/**
 * The application's notifications, on Radix's Toast, already a dependency:
 * swipe, hotkey and a screen-reader announcement without moving focus.
 * Direction comes from `DirectionProvider`.
 */

type ToastTone = 'success' | 'error' | 'info';

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type QueuedToast = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * Raises a notification. Available anywhere under `ToastViewport`, which the
 * locale layout renders - so a caller never has to check whether it is mounted.
 */
export function useToast() {
  const show = useContext(ToastContext);

  if (!show) {
    throw new Error('useToast must be used inside <ToastViewport>');
  }

  return show;
}

// On shadcn's own tokens: a popover surface for every tone, and the signal
// colour reserved for failure.
const TONE: Record<ToastTone, string> = {
  success: 'border-border',
  error: 'border-destructive/50 text-destructive',
  info: 'border-border',
};

const DOT: Record<ToastTone, string> = {
  success: 'bg-primary',
  error: 'bg-destructive',
  info: 'bg-muted-foreground',
};

export function ToastViewport({ children }: { children: ReactNode }) {
  const t = useTranslations('site.notifications');
  const [queue, setQueue] = useState<QueuedToast[]>([]);

  const show = useCallback((toast: ToastInput) => {
    setQueue((current) => [
      ...current,
      // `Date.now()` would collide for two raised in the same millisecond.
      { ...toast, id: current.at(-1) ? current.at(-1)!.id + 1 : 1 },
    ]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setQueue((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}

        {queue.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            onOpenChange={(open) => {
              if (!open) {
                dismiss(toast.id);
              }
            }}
            className={cn(
              'group pointer-events-auto grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-2',
              'data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none',
              'data-[swipe=end]:animate-out',
              TONE[toast.tone ?? 'info'],
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                DOT[toast.tone ?? 'info'],
              )}
            />

            <div className="flex min-w-0 flex-col gap-1">
              <ToastPrimitive.Title className="text-sm font-semibold">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description ? (
                <ToastPrimitive.Description
                  dir="auto"
                  className="text-sm text-muted-foreground"
                >
                  {toast.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>

            <ToastPrimitive.Close
              className="-me-1 -mt-1 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={t('close')}
            >
              <XIcon className="size-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}

        {/* Clear of the safe area on a notched screen. */}
        <ToastPrimitive.Viewport
          label={t('label')}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-100 mx-auto flex w-full max-w-[26rem] flex-col gap-2 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] outline-none lg:bottom-auto lg:top-0 lg:start-auto lg:end-0 lg:mx-0 lg:pb-4 lg:pt-17"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
