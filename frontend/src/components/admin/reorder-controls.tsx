'use client';

import { useTranslations } from 'next-intl';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ReorderControlsProps = {
  /** Where this row sits, and how many there are, so the ends can be disabled. */
  index: number;
  total: number;
  /** What this row is called, so each button says which row it moves. */
  label: string;
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
};

/**
 * Move up and down rather than drag: no dependency, keyboard and touch
 * accessible for free, and nothing flaky to test. Each button names its row for
 * screen readers.
 */
export function ReorderControls({
  index,
  total,
  label,
  onMove,
  disabled,
}: ReorderControlsProps) {
  const t = useTranslations('admin.reorder');

  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={t('moveUp', { name: label })}
        disabled={disabled || index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ChevronUpIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={t('moveDown', { name: label })}
        disabled={disabled || index === total - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ChevronDownIcon aria-hidden />
      </Button>
    </div>
  );
}

/** The list with one entry moved, without mutating the original. */
export function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);

  if (item === undefined) {
    return items;
  }

  next.splice(to, 0, item);

  return next;
}
