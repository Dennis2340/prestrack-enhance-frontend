"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: string; kind: ToastKind; message: string };

type ToastCtx = {
  toasts: ToastItem[];
  show: (message: string, kind?: ToastKind) => void;
  remove: (id: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, kind, message }]);
    // auto-remove after 4s
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value = useMemo(() => ({ toasts, show, remove }), [toasts, show, remove]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Container */}
      <div className="fixed inset-x-0 top-2 z-[1000] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded shadow px-3 py-2 text-sm text-white ${t.kind === 'success' ? 'bg-green-600' : t.kind === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
