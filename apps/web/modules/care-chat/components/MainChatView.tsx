"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ArrowDownToLine,
  ArrowLeft,
  History,
  MoreVertical,
  Phone,
  SendHorizontal,
  Trash2,
  X
} from "lucide-react";
import type { CareChatViewProps } from "./viewTypes";
import { handleActionKeyDown, handleImageError, LetterAvatar } from "./viewTypes";
import { ImagePreviewOverlay } from "./ImagePreviewOverlay";
function renderFormattedText(text: string) {
  if (!text) return null;

  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const url = linkMatch[2];
      const isDataOrPdf = url.startsWith("data:") || url.includes(".pdf") || url.includes("/api/report/pdf");

      return (
        <a
          key={index}
          href={url}
          download={isDataOrPdf ? "Medical_Report.pdf" : undefined}
          target={url.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 600,
            color: "#1a73e8",
            textDecoration: "underline",
            marginTop: "6px",
            marginBottom: "4px",
            padding: "6px 12px",
            borderRadius: "8px",
            backgroundColor: "rgba(26, 115, 232, 0.1)"
          }}
        >
          {label}
        </a>
      );
    }

    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return <strong key={index}>{boldMatch[1]}</strong>;
    }

    return part;
  });
}

export function MainChatView({ vm }: CareChatViewProps) {
  return (
    <div className={`view ${vm.isChatView ? "active" : "hidden"}`}>
      <header className={`chat-header glassmorphism ${vm.showSearch ? "show-search" : ""}`}>
        <div
          className="header-left"
          onClick={vm.showProfile}
          onKeyDown={(event) => handleActionKeyDown(event, vm.showProfile)}
          role="button"
          tabIndex={0}
        >
          <button className="icon-btn back-btn" style={{ display: "none" }} type="button">
            <ArrowLeft />
          </button>
          <div className="profile-pic">
            <LetterAvatar name={vm.contactProfile.name} size={40} />
          </div>
          <div className="contact-info">
            <h2>{vm.contactProfile.name}</h2>
            <span>{vm.isSyncing ? "Syncing..." : vm.contactProfile.statusText}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={vm.startCall} type="button" aria-label="Call">
            <Phone />
          </button>
          <div>
            <button
              className="icon-btn"
              onClick={(event) => {
                event.stopPropagation();
                vm.setChatMenuOpen((prev) => !prev);
              }}
              id="menu-trigger"
              type="button"
              aria-label="Menu"
            >
              <MoreVertical />
            </button>

            <div className={`dropdown-menu ${vm.chatMenuOpen ? "active" : ""}`} id="chat-menu">
              <button
                id="install-app-btn"
                style={{ display: vm.deferredPrompt ? "flex" : "none" }}
                onClick={vm.triggerInstall}
                type="button"
              >
                <ArrowDownToLine />
                Install App
              </button>
              <button onClick={vm.openHistory} type="button">
                <History />
                Call History
              </button>
              <button onClick={() => { vm.setChatMenuOpen(false); vm.clearChatHistory(); }} type="button">
                <Trash2 />
                Clear Chat
              </button>
            </div>
          </div>
        </div>

        <div className="search-bar-container" id="search-bar-container">
          <button className="icon-btn" onClick={() => { vm.setShowSearch(false); vm.setSearchText(""); }} type="button">
            <ArrowLeft />
          </button>
          <input
            type="text"
            placeholder="Search..."
            id="search-input"
            className="search-input"
            value={vm.searchText}
            onChange={(event) => vm.setSearchText(event.target.value)}
          />
          <button className="icon-btn" onClick={() => { vm.setShowSearch(false); vm.setSearchText(""); }} type="button">
            <X />
          </button>
        </div>
      </header>

      {vm.isCallConnected && (
        <div
          className="active-call-bar"
          onClick={() => vm.switchView("calling")}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => handleActionKeyDown(event, () => vm.switchView("calling"))}
        >
          <div className="active-call-content">
            <span className="pulse-dot"></span>
            <span>Ongoing Call with {vm.contactProfile.name} ({vm.callStatus})</span>
          </div>
          <span className="tap-return-text">Tap to return</span>
        </div>
      )}

      <main className={`chat-canvas ${vm.isCallConnected ? "has-active-call-bar" : ""}`} id="message-container">
        {!vm.localDataReady ? <div className="message bot-msg system-msg">Loading local messages...</div> : null}

        {vm.filteredChatMessages.map((message) => {
          if (message.kind === "system") {
            return (
              <div key={message.id} className="message bot-msg system-msg">
                {message.text}
              </div>
            );
          }

          if (message.kind === "image") {
            return (
              <div key={message.id} className={`message ${message.role === "bot" ? "bot-msg" : "patient-msg"} image-message`}>
                <img
                  src={message.imageUrl}
                  alt={message.caption ? `Shared image: ${message.caption}` : "Shared image from chat"}
                  onClick={() => vm.openImage(message.imageUrl)}
                  onError={handleImageError}
                />
                {message.caption ? <p>{message.caption}</p> : null}
                <span className="time">{message.time}</span>
              </div>
            );
          }

          return (
            <div key={message.id} className={`message ${message.role === "bot" ? "bot-msg" : "patient-msg"}`}>
              {renderFormattedText(message.text)}
              <span className="time">{message.time}</span>
            </div>
          );
        })}
      </main>

      <footer className="chat-input-area glassmorphism">
        <textarea
          placeholder="Message..."
          rows={1}
          id="chat-input"
          value={vm.messageText}
          onChange={(event) => vm.setMessageText(event.target.value)}
        />

        <div className="input-actions">
          <button
            className="icon-btn send-btn primary-bg"
            id="send-btn"
            onClick={vm.sendMessageFromInput}
            type="button"
            disabled={vm.messageText.trim().length === 0}
            aria-label="Send message"
          >
            <SendHorizontal />
          </button>
        </div>
      </footer>
      <ImagePreviewOverlay vm={vm} />
    </div>
  );
}
