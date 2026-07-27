import { useCallback, useEffect, useRef, useState } from 'react';

const HOVER_DELAY = 130;
const CLOSE_DELAY = 240;

export function useMegaMenu(itemCount: number) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const pinnedRef = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const focusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openIndexRef = useRef<number | null>(null);

  useEffect(() => {
    openIndexRef.current = openIndex;
  }, [openIndex]);

  const clearTimers = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeAll = useCallback(
    (refocus = false) => {
      clearTimers();
      setOpenIndex(null);
      pinnedRef.current = false;
      if (refocus) {
        focusTriggerRef.current?.focus();
      }
      focusTriggerRef.current = null;
    },
    [clearTimers],
  );

  const openMenu = useCallback(
    (index: number, pin: boolean) => {
      clearTimers();
      pinnedRef.current = pin;
      focusTriggerRef.current =
        itemRefs.current[index]?.querySelector<HTMLButtonElement>('.nav-mm-trigger') ?? null;
      setOpenIndex(index);
    },
    [clearTimers],
  );

  const handlePointerEnter = useCallback(
    (index: number, pointerType: string) => {
      if (pointerType === 'touch') return;
      clearTimers();
      if (openIndexRef.current !== null && openIndexRef.current !== index) {
        openMenu(index, pinnedRef.current);
        return;
      }
      if (openIndexRef.current === null) {
        hoverTimer.current = setTimeout(() => openMenu(index, false), HOVER_DELAY);
      }
    },
    [clearTimers, openMenu],
  );

  const handlePointerLeave = useCallback(
    (index: number, pointerType: string) => {
      if (pointerType === 'touch') return;
      clearTimers();
      if (openIndexRef.current === index && !pinnedRef.current) {
        closeTimer.current = setTimeout(() => {
          if (openIndexRef.current === index && !pinnedRef.current) {
            setOpenIndex(null);
          }
        }, CLOSE_DELAY);
      }
    },
    [clearTimers],
  );

  const handleTriggerClick = useCallback(
    (index: number) => {
      if (openIndexRef.current === index && pinnedRef.current) {
        closeAll(false);
      } else if (openIndexRef.current === index) {
        pinnedRef.current = true;
      } else {
        openMenu(index, true);
      }
    },
    [closeAll, openMenu],
  );

  const handleTriggerKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        openMenu(index, true);
        requestAnimationFrame(() => {
          const li = itemRefs.current[index];
          const first =
            li?.querySelector<HTMLElement>('.nav-mm-pop .nav-mm-panel .nav-mm-featured[href]') ??
            li?.querySelector<HTMLElement>('.nav-mm-pop .nav-mm-panel .nav-mm-list a[href]');
          first?.focus();
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTriggerClick(index);
      }
    },
    [handleTriggerClick, openMenu],
  );

  const handleItemKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLElement>) => {
      if (openIndex !== index) return;
      const links = Array.from(
        itemRefs.current[index]?.querySelectorAll<HTMLElement>('.nav-mm-pop .nav-mm-panel a[href]') ?? [],
      );
      const activeIndex = links.indexOf(document.activeElement as HTMLElement);
      const btn = itemRefs.current[index]?.querySelector<HTMLButtonElement>('.nav-mm-trigger');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        links[Math.min(activeIndex + 1, links.length - 1)]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIndex <= 0) btn?.focus();
        else links[activeIndex - 1]?.focus();
      } else if (e.key === 'Home' && activeIndex >= 0) {
        e.preventDefault();
        links[0]?.focus();
      } else if (e.key === 'End' && activeIndex >= 0) {
        e.preventDefault();
        links[links.length - 1]?.focus();
      }
    },
    [openIndex],
  );

  const handleFocusOut = useCallback(
    (index: number) => {
      requestAnimationFrame(() => {
        if (openIndex === index && !itemRefs.current[index]?.contains(document.activeElement)) {
          closeAll(false);
        }
      });
    },
    [closeAll, openIndex],
  );

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (openIndex === null) return;
      const target = e.target as Node;
      if ((target as Element).closest?.('.nav-scrim')) {
        closeAll(false);
        return;
      }
      const nav = itemRefs.current[openIndex]?.closest('.nav-hnav, .nav-sticky');
      if (nav && !nav.contains(target)) closeAll(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openIndex !== null) closeAll(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeAll, openIndex]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const setItemRef = useCallback((index: number, el: HTMLLIElement | null) => {
    itemRefs.current[index] = el;
  }, []);

  return {
    openIndex,
    itemRefs,
    setItemRef,
    closeAll,
    handlePointerEnter,
    handlePointerLeave,
    handleTriggerClick,
    handleTriggerKeyDown,
    handleItemKeyDown,
    handleFocusOut,
    itemCount,
  };
}

export function useHeaderScroll() {
  const [isScrolled, setIsScrolled] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    const apply = () => {
      setIsScrolled(window.scrollY > 24);
      ticking.current = false;
    };
    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(apply);
      }
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return isScrolled;
}
