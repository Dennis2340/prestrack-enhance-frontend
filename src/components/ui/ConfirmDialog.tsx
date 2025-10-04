"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

export function ConfirmDialog({
  title = "Confirm",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const doConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed inset-0 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Close className="text-gray-500">✕</Dialog.Close>
            </div>
            {description && (
              <div className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{description}</div>
            )}
            <div className="flex items-center justify-end gap-2">
              <Dialog.Close className="px-4 py-2 rounded border">{cancelLabel}</Dialog.Close>
              <button onClick={doConfirm} disabled={busy || loading} className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50">
                {busy || loading ? "Working…" : confirmLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
