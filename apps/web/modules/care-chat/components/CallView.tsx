"use client";

import { Mic, MicOff, Pause, PhoneCall, PhoneIncoming, PhoneOff, PhoneOutgoing, Volume2, VolumeX } from "lucide-react";
import type { CareChatViewProps } from "./viewTypes";
import { LetterAvatar } from "./viewTypes";

export function CallView({ vm }: CareChatViewProps) {
  const isIncomingCall = vm.callDirection === "incoming";
  const directionBadgeTone = vm.callDirection === "incoming" ? "incoming" : vm.callDirection === "outgoing" ? "outgoing" : "neutral";
  const directionLabel = vm.callDirection === "incoming" ? "Incoming" : vm.callDirection === "outgoing" ? "Outgoing" : "Call";
  const isIncomingRinging = vm.isRinging && vm.callDirection === "incoming";
  const isOutgoingRinging = vm.isRinging && vm.callDirection === "outgoing";

  return (
    <div className={`view fullscreen-view call-gradient ${vm.activeView === "calling" ? "active" : "hidden"}`}>
      <div className="call-top">
        <div className="call-meta-row">
          <span className={`call-direction-badge ${directionBadgeTone}`}>
            {isIncomingCall ? <PhoneIncoming /> : <PhoneOutgoing />}
            {directionLabel}
          </span>
        </div>
        <h2 id="call-name">{vm.contactProfile.name}</h2>
        <span id="call-status">{vm.callStatus}</span>
      </div>
      <div className="call-center">
        <div className={`avatar-ring ${vm.isRinging ? "is-ringing" : ""}`}>
          <LetterAvatar name={vm.contactProfile.name} size="100%" />
        </div>
      </div>
      {isIncomingRinging ? (
        <div className="call-controls call-controls-compact bottom-bar">
          <button className="ctrl-btn end-call ctrl-stack" onClick={vm.endCall} type="button" aria-label="Decline call">
            <PhoneOff />
            <small>Decline</small>
          </button>
          <button
            className="ctrl-btn accept-call ctrl-stack"
            onClick={vm.handlePrimaryCallAction}
            type="button"
            aria-label="Accept call"
          >
            <PhoneCall />
            <small>Accept</small>
          </button>
        </div>
      ) : isOutgoingRinging ? (
        <div className="call-controls call-controls-compact bottom-bar">
          <button
            className="ctrl-btn connect-call ctrl-stack"
            onClick={vm.handlePrimaryCallAction}
            type="button"
            aria-label="Connect now"
          >
            <PhoneCall />
            <small>Connect</small>
          </button>
          <button className="ctrl-btn end-call ctrl-stack" onClick={vm.endCall} type="button" aria-label="Cancel call">
            <PhoneOff />
            <small>Cancel</small>
          </button>
        </div>
      ) : (
        <div className="call-controls bottom-bar">
          <button
            className={`ctrl-btn ${vm.isCallOnHold ? "is-active" : ""}`}
            onClick={vm.toggleCallHold}
            type="button"
            aria-label={vm.isCallOnHold ? "Resume call" : "Hold call"}
          >
            <Pause />
          </button>
          <button
            className={`ctrl-btn ${vm.isMicMuted ? "is-active" : ""}`}
            onClick={vm.toggleMicrophone}
            type="button"
            aria-label={vm.isMicMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {vm.isMicMuted ? <MicOff /> : <Mic />}
          </button>
          <button
            className={`ctrl-btn ${vm.isSpeakerEnabled ? "is-active" : ""}`}
            onClick={vm.toggleSpeaker}
            type="button"
            aria-label={vm.isSpeakerEnabled ? "Disable speaker" : "Enable speaker"}
          >
            {vm.isSpeakerEnabled ? <Volume2 /> : <VolumeX />}
          </button>
          <button className="ctrl-btn end-call" onClick={vm.endCall} type="button" aria-label="End call">
            <PhoneOff />
          </button>
        </div>
      )}
    </div>
  );
}
