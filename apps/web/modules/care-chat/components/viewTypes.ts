import type { KeyboardEvent } from "react";
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
