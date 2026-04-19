"use client";

import { AddScheduleOverlay } from "./components/AddScheduleOverlay";
import { CalendarOverlay } from "./components/CalendarOverlay";
import { CallView } from "./components/CallView";
import { CameraView } from "./components/CameraView";
import { DocumentView } from "./components/DocumentView";
import { HistoryView } from "./components/HistoryView";
import { MainChatView } from "./components/MainChatView";
import { MediaView } from "./components/MediaView";
import { ProfileView } from "./components/ProfileView";
import { useCareChatController } from "./useCareChatController";

export default function CareChatPage() {
  const vm = useCareChatController();

  return (
    <div className="app-container">
      <MainChatView vm={vm} />
      <DocumentView vm={vm} />
      <CallView vm={vm} />
      <CameraView vm={vm} />
      <CalendarOverlay vm={vm} />
      <AddScheduleOverlay vm={vm} />
      <HistoryView vm={vm} />
      <MediaView vm={vm} />
      <ProfileView vm={vm} />

      <div id="toast" className={`toast ${vm.toastVisible ? "show" : ""}`}>
        {vm.toastText}
      </div>
    </div>
  );
}
