"use client";

import {
  ChevronDown,
  Mic,
  MicOff,
  Pause,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  PhoneOutgoing,
  Play,
  Share2,
  Volume2,
  VolumeX
} from "lucide-react";
import type { CareChatViewProps } from "./viewTypes";
import { LetterAvatar } from "./viewTypes";

export function CallView({ vm }: CareChatViewProps) {
  const isIncomingCall = vm.callDirection === "incoming";
  const directionBadgeTone = vm.callDirection === "incoming" ? "incoming" : vm.callDirection === "outgoing" ? "outgoing" : "neutral";
  const directionLabel = vm.callDirection === "incoming" ? "Incoming" : vm.callDirection === "outgoing" ? "Outgoing" : "Call";
  const isIncomingRinging = vm.isRinging && vm.callDirection === "incoming";
  const isOutgoingRinging = vm.isRinging && vm.callDirection === "outgoing";
  const isCallActive = !vm.isRinging && vm.callStatus !== "Idle" && vm.callStatus !== "Call ended" && vm.callStatus !== "Missed call";

  return (
    <div className={`view fullscreen-view call-gradient ${vm.activeView === "calling" ? "active" : "hidden"}`}>
      {/* Top Navigation Row: Minimize to Chat, Direction Badge, Share Link */}
      <div className="call-header-nav">
        <button
          className="call-nav-action-btn"
          onClick={() => vm.switchView("chat")}
          type="button"
          aria-label="Return to chat"
          title="Return to chat"
        >
          <ChevronDown />
          <span>Chat</span>
        </button>

        <div className="call-meta-row">
          <span className={`call-direction-badge ${directionBadgeTone}`}>
            {isIncomingCall ? <PhoneIncoming /> : <PhoneOutgoing />}
            {directionLabel}
          </span>
        </div>

        <button
          className="call-nav-action-btn icon-only"
          onClick={vm.generateCallLink}
          type="button"
          aria-label="Copy call link"
          title="Share call link"
        >
          <Share2 />
        </button>
      </div>

      {/* Main Call Info Header */}
      <div className="call-top">
        <h2 id="call-name">{vm.contactProfile.name}</h2>
        <div className="call-status-wrapper">
          {isCallActive && <span className="active-call-indicator" />}
          <span id="call-status">{vm.callStatus}</span>
        </div>
      </div>

      {/* Center Stage: Avatar with dynamic pulse states and audio activity wave */}
      <div className="call-center">
        <div className={`avatar-ring ${vm.isRinging ? "is-ringing" : isCallActive ? "is-active-call" : ""}`}>
          <LetterAvatar name={vm.contactProfile.name} size="100%" />
        </div>
        {isCallActive && !vm.isCallOnHold && (
          <div className="voice-activity-indicator" aria-hidden="true">
            <span className="wave-bar bar-1"></span>
            <span className="wave-bar bar-2"></span>
            <span className="wave-bar bar-3"></span>
            <span className="wave-bar bar-4"></span>
            <span className="wave-bar bar-5"></span>
          </div>
        )}
      </div>

      {/* Bottom Bar: Contextual controls that match native phone UX */}
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
        <div className="call-controls bottom-bar">
          <button
            className={`ctrl-btn ctrl-stack ${vm.isMicMuted ? "is-muted" : ""}`}
            onClick={vm.toggleMicrophone}
            type="button"
            aria-label={vm.isMicMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {vm.isMicMuted ? <MicOff /> : <Mic />}
            <small>{vm.isMicMuted ? "Unmute" : "Mute"}</small>
          </button>
          <button className="ctrl-btn end-call ctrl-stack" onClick={vm.endCall} type="button" aria-label="Cancel call">
            <PhoneOff />
            <small>Cancel</small>
          </button>
          <button
            className={`ctrl-btn ctrl-stack ${vm.isSpeakerEnabled ? "is-active" : ""}`}
            onClick={vm.toggleSpeaker}
            type="button"
            aria-label={vm.isSpeakerEnabled ? "Disable speaker" : "Enable speaker"}
          >
            {vm.isSpeakerEnabled ? <Volume2 /> : <VolumeX />}
            <small>Speaker</small>
          </button>
        </div>
      ) : (
        <div className="call-controls bottom-bar">
          <button
            className={`ctrl-btn ctrl-stack ${vm.isCallOnHold ? "is-active" : ""}`}
            onClick={vm.toggleCallHold}
            type="button"
            aria-label={vm.isCallOnHold ? "Resume call" : "Hold call"}
          >
            {vm.isCallOnHold ? <Play /> : <Pause />}
            <small>{vm.isCallOnHold ? "Resume" : "Hold"}</small>
          </button>
          <button
            className={`ctrl-btn ctrl-stack ${vm.isMicMuted ? "is-muted" : ""}`}
            onClick={vm.toggleMicrophone}
            type="button"
            aria-label={vm.isMicMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {vm.isMicMuted ? <MicOff /> : <Mic />}
            <small>{vm.isMicMuted ? "Unmute" : "Mute"}</small>
          </button>
          <button
            className={`ctrl-btn ctrl-stack ${vm.isSpeakerEnabled ? "is-active" : ""}`}
            onClick={vm.toggleSpeaker}
            type="button"
            aria-label={vm.isSpeakerEnabled ? "Disable speaker" : "Enable speaker"}
          >
            {vm.isSpeakerEnabled ? <Volume2 /> : <VolumeX />}
            <small>Speaker</small>
          </button>
          <button className="ctrl-btn end-call ctrl-stack" onClick={vm.endCall} type="button" aria-label="End call">
            <PhoneOff />
            <small>End</small>
          </button>
        </div>
      )}
    </div>
  );
}
