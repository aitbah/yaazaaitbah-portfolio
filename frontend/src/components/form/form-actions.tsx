'use client';

import { ErrorToast } from '@/components/error-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type FormActionsProps = {
  submitLabel: string;
  /** What the button says while the request is in flight. */
  submittingLabel: string;
  isPending: boolean;
  /** Omitted by a form with nowhere to go back to. */
  cancelLabel?: string;
  onCancel?: () => void;
  /** The failure that belongs to the form as a whole, already translated. */
  error?: string | null;
};

/**
 * The row every editor ends with: the whole-form error, then save and cancel.
 * Cancel is disabled while saving, since the mutation would continue with
 * nothing to report it. Ruled off like a section.
 */
export function FormActions({
  submitLabel,
  submittingLabel,
  isPending,
  cancelLabel,
  onCancel,
  error,
}: FormActionsProps) {
  return (
    <div className="flex flex-col gap-4 border-t pt-6">
      <ErrorToast>{error ? error : null}</ErrorToast>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner aria-hidden />
              {submittingLabel}
            </>
          ) : (
            submitLabel
          )}
        </Button>

        {onCancel && cancelLabel ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
