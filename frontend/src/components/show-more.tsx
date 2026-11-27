'use client';

import { useTranslations } from 'next-intl';
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** What a control offers more of - each one a key under `site.showMore`. */
export type ShowMoreNoun =
  | 'projects'
  | 'skills'
  | 'technologies'
  | 'tools'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'courses'
  | 'languages'
  | 'socialLinks'
  | 'gallery'
  | 'options'
  | 'messages';

type Progress = { requested: number; revealedFrom: number; reveals: number };

/**
 * How far each list is open, by name, outside React: an admin list unmounts
 * for the editor and must come back where it was.
 */
const progress = new Map<string, Progress>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function advance(id: string, from: number, step: number) {
  progress.set(id, {
    requested: from + step,
    revealedFrom: from,
    reveals: (progress.get(id)?.reveals ?? 0) + 1,
  });
  listeners.forEach((listener) => listener());
}

/** Every list back to its first step. For tests, which share one module. */
export function resetShowMore() {
  progress.clear();
  listeners.forEach((listener) => listener());
}

export type ShowMoreState = {
  visible: number;
  total: number;
  step: number;
  hasMore: boolean;
  showMore: () => void;
  /** Where the latest reveal started, and how many reveals there have been. */
  revealedFrom: number;
  reveals: number;
  /** True while the next step is still being fetched. */
  isLoading?: boolean;
};

export function useShowMore(
  id: string,
  total: number,
  step: number,
): ShowMoreState & {
  /** Reveals the next step if `index` is past the visible ones. */
  reveal: (index: number) => void;
} {
  const opened = useSyncExternalStore(
    subscribe,
    () => progress.get(id),
    // The server renders every list at its first step.
    () => undefined,
  );

  // Clamped on read, so a list that shrinks never claims more than it has.
  const visible = Math.min(opened?.requested ?? step, total);
  const showMore = () => advance(id, visible, step);

  return {
    visible,
    total,
    step,
    hasMore: visible < total,
    showMore,
    reveal(index) {
      if (index >= visible) {
        showMore();
      }
    },
    revealedFrom: opened?.revealedFrom ?? 0,
    reveals: opened?.reveals ?? 0,
  };
}

/**
 * Moves focus to the first newly shown item, once it exists. Reveals counted
 * before mount are ignored, so a list returning from the editor keeps focus.
 */
export function useRevealFocus(
  container: RefObject<HTMLElement | null>,
  reveals: number,
  revealedFrom: number,
) {
  const handled = useRef(reveals);

  useEffect(() => {
    if (reveals === handled.current) {
      return;
    }

    const item = container.current?.children.item(revealedFrom);

    if (!(item instanceof HTMLElement)) {
      return;
    }

    handled.current = reveals;
    item.tabIndex = -1;
    item.focus();
  });
}

type ShowMoreListProps = {
  /** e.g. `site.projects`; how far it is open is kept under it. */
  id: string;
  step: number;
  noun: ShowMoreNoun;
  /** Each one an `<li>`, already keyed. Built whole; only the slice is shown. */
  items: ReactNode[];
  as?: 'ul' | 'ol';
  className?: string;
  controlClassName?: string;
};

/**
 * The first step of a list and a control for the rest. Takes rendered items,
 * so server markup (brand marks included) never reaches the bundle.
 */
export function ShowMoreList({
  id,
  step,
  noun,
  items,
  as: List = 'ul',
  className,
  controlClassName,
}: ShowMoreListProps) {
  const state = useShowMore(id, items.length, step);
  const list = useRef<HTMLOListElement>(null);

  useRevealFocus(list, state.reveals, state.revealedFrom);

  return (
    <>
      <List ref={list} className={className}>
        {items.slice(0, state.visible)}
      </List>

      <ShowMoreControl state={state} noun={noun} className={controlClassName} />
    </>
  );
}

/** The count, as a live region, and the next-step button; nothing if one step fits. */
export function ShowMoreControl({
  state,
  noun,
  className,
}: {
  state: Pick<
    ShowMoreState,
    'visible' | 'total' | 'step' | 'hasMore' | 'showMore' | 'isLoading'
  >;
  noun: ShowMoreNoun;
  className?: string;
}) {
  const t = useTranslations('site.showMore');

  if (state.total <= state.step) {
    return null;
  }

  return (
    <div className={cn('mt-6 flex flex-col items-center gap-3', className)}>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {t('status', { shown: state.visible, total: state.total })}
      </p>

      {state.hasMore ? (
        <Button
          type="button"
          variant="outline"
          data-more={noun}
          onClick={state.showMore}
          disabled={state.isLoading}
        >
          {t(noun)}
        </Button>
      ) : null}
    </div>
  );
}
