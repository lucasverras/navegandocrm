"use client";

import { useEffect, useId } from "react";

// Shared overlay/dialog primitive — extracted from the ad hoc markup CloseDealDialog used
// to hand-roll. New stage-entry modals (Reunião marcada, Proposta enviada) and the
// campaign-duplicate prompt all use this instead of copy-pasting the overlay again.
export function Modal({
  title,
  description,
  onClose,
  closable = true,
  children,
  maxWidthClassName = "max-w-md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  closable?: boolean;
  children: React.ReactNode;
  maxWidthClassName?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && closable) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, closable]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${maxWidthClassName} rounded-xl border border-border bg-surface p-5 shadow-xl`}
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
