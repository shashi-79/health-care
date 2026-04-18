"use client";

/* eslint-disable @next/next/no-img-element */

import type { CareChatViewProps } from "./viewTypes";

export function CallView({ vm }: CareChatViewProps) {
  return (
    <div className={`view fullscreen-view call-gradient ${vm.activeView === "calling" ? "active" : "hidden"}`}>
      <div className="call-top">
        <h2 id="call-name">{vm.contactProfile.name}</h2>
        <span id="call-status">{vm.callStatus}</span>
      </div>
      <div className="call-center">
        <div className={`avatar-ring ${vm.isRinging ? "is-ringing" : ""}`}>
          <img src={vm.contactProfile.avatarUrl} alt={vm.contactProfile.name} />
        </div>
      </div>
      <div className="call-controls bottom-bar">
        <button className="ctrl-btn" type="button">
          ⏸
        </button>
        <button className="ctrl-btn" type="button">
          🎙
        </button>
        <button className="ctrl-btn" type="button">
          🔊
        </button>
        <button className="ctrl-btn end-call" onClick={vm.endCall} type="button">
          📵
        </button>
      </div>
    </div>
  );
}
