import type { ReactNode } from 'react';

/**
 * Short related fields side by side, stacking when there is no room. A
 * container query, so it follows the form's width rather than the window's.
 */
export function FieldRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 @2xl/field-group:grid-cols-2">{children}</div>
  );
}
