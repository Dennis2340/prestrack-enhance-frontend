"use client"

import React from 'react'

type AppModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
  actions?: React.ReactNode
}

export function AppModal({ open, onClose, title, children, actions }: AppModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{title || 'Notice'}</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <div className="text-sm text-gray-800 whitespace-pre-wrap">{children}</div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {actions || (
            <button onClick={onClose} className="px-4 py-2 rounded border">Close</button>
          )}
        </div>
      </div>
    </div>
  )
}
