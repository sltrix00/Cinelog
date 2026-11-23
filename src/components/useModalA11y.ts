import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

interface UseModalA11yOptions {
  open: boolean;
  onClose: () => void;
  disabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Provides Escape key dismissal, Tab/Shift+Tab focus trap, focus restoration,
 * and background body scroll lock for accessible dialogs.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  disabled = false,
  initialFocusRef,
}: UseModalA11yOptions) {
  const modalRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);

  onCloseRef.current = onClose;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!open) return;

    const previousActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const rafId = window.requestAnimationFrame(() => {
      const container = modalRef.current;
      if (!container) return;
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      if (!container.contains(document.activeElement)) {
        const focusable = getFocusableElements(container);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          container.focus();
        }
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!disabledRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        const container = modalRef.current;
        if (!container) return;
        const focusable = getFocusableElements(container);
        if (focusable.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      if (previousActive && previousActive.isConnected) {
        previousActive.focus();
      }
    };
  }, [open, initialFocusRef]);

  return modalRef;
}
