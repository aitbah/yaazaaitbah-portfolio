import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type EditorPanelProps = {
  title: string;
  children: ReactNode;
};

/**
 * The panel a list's editor opens into: a card, roomier than the vendored
 * default so a long form does not crowd its edges, with the header ruled off.
 */
export function EditorPanel({ title, children }: EditorPanelProps) {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader className="border-b">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
