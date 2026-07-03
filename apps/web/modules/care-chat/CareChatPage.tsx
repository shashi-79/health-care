"use client";

import { CallView } from "./components/CallView";
import { HistoryView } from "./components/HistoryView";
import { MainChatView } from "./components/MainChatView";
import { ProfileView } from "./components/ProfileView";
import { useCareChatController } from "./useCareChatController";

export default function CareChatPage() {
  const vm = useCareChatController();

  return (
    <div className="app-container">
      <MainChatView vm={vm} />
      <CallView vm={vm} />

      <HistoryView vm={vm} />
      <ProfileView vm={vm} />

      <div id="toast" className={`toast ${vm.toastVisible ? "show" : ""}`}>
        {vm.toastText}
      </div>
    </div>
  );
}
