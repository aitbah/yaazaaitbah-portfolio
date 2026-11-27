import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  /** What the page is for, when the title alone does not say it. */
  description?: string;
  /** The page's primary action, if it has one. */
  action?: ReactNode;
};

/**
 * The top of every admin page, written once so titles and actions line up
 * everywhere. On a narrow screen the action goes below the title.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
