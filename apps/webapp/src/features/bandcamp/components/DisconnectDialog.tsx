import { ConfirmDialog } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";

interface DisconnectDialogProps {
  isOpen: boolean;
  busy: boolean;
  failed: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DisconnectDialog({ isOpen, busy, failed, onClose, onConfirm }: DisconnectDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      tone="danger"
      busy={busy}
      busyLabel={BANDCAMP_COPY.disconnect.busy}
      title={BANDCAMP_COPY.disconnect.title}
      message={BANDCAMP_COPY.disconnect.message}
      confirmLabel={BANDCAMP_COPY.disconnect.confirm}
    >
      {failed ? (
        <p
          role="alert"
          className="mt-[var(--px-8)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]"
        >
          {BANDCAMP_COPY.disconnect.failed}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
