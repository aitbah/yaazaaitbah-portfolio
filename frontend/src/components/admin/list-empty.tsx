import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

type ListEmptyProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** The action that ends the emptiness, when the list has one. */
  action?: ReactNode;
};

/**
 * What a list says when it holds nothing.
 *
 * A framed state rather than one grey sentence: an empty page is where a new
 * admin arrives first, and "No skills yet" floating alone reads like something
 * failed to load. The same icon the sidebar uses ties it to the section.
 */
export function ListEmpty({
  icon: Icon,
  title,
  description,
  action,
}: ListEmptyProps) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}
