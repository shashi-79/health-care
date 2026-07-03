"use client";

import { X } from "lucide-react";
import type { CareChatViewProps } from "./viewTypes";

export function ImagePreviewOverlay({ vm }: CareChatViewProps) {
  if (!vm.previewImageUrl) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      {/* Top Header Controls */}
      <header className="absolute top-0 left-0 w-full flex items-center justify-between p-4 z-10 calc-safe-top">
        <button
          onClick={vm.closeImagePreview}
          className="icon-btn text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition"
          type="button"
          aria-label="Close Preview"
        >
          <X size={20} />
        </button>
      </header>

      {/* Main Image Frame */}
      <div className="relative max-w-full max-h-[75vh] aspect-auto rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-950 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={vm.previewImageUrl}
          alt="Fullscreen preview"
          className="max-w-full max-h-[75vh] object-contain select-none"
        />
      </div>
    </div>
  );
}
