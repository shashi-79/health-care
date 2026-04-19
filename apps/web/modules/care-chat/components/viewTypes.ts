import type { KeyboardEvent, SyntheticEvent } from "react";
import type { CareChatViewModel } from "../useCareChatController";

export type CareChatViewProps = {
  vm: CareChatViewModel;
};

export function handleActionKeyDown(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

const FALLBACK_IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23dfe3eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236f7887' font-family='Arial' font-size='16'%3EImage%3C/text%3E%3C/svg%3E";

export function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const target = event.currentTarget;
  if (target.dataset.fallbackApplied === "1") {
    return;
  }

  target.dataset.fallbackApplied = "1";
  target.src = FALLBACK_IMAGE_DATA_URI;
}
