'use client';

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';

/** Every string this renders, so no namespace is named inside the component. */
export type RowActionLabels = {
  /** Names the row, so twenty menus on a page are twenty different buttons. */
  menu: string;
  edit: string;
  delete: string;
  deleting: string;
  /** The question the confirmation asks. */
  confirmTitle: string;
  confirmDescription: string;
  cancel: string;
};

type RowActionsProps = {
  labels: RowActionLabels;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
};

/**
 * Edit and delete for one row, in a menu so a grid is not more buttons than
 * content. Delete confirms in a real dialog, visible to assistive technology,
 * unlike `window.confirm`. The dialog is the menu's sibling, since a menu
 * unmounts on select.
 */
export function RowActions({
  labels,
  onEdit,
  onDelete,
  isDeleting,
}: RowActionsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={labels.menu}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Spinner aria-hidden />
            ) : (
              <MoreHorizontalIcon aria-hidden />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <PencilIcon aria-hidden />
            {labels.edit}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirming(true)}
          >
            <Trash2Icon aria-hidden />
            {labels.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {labels.confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction
              // Not the default action: the dialog exists because this is the
              // one thing on the row that cannot be undone.
              variant="destructive"
              onClick={onDelete}
            >
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
