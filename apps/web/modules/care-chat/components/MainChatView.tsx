"use client";

/* eslint-disable @next/next/no-img-element */

import type { CareChatViewProps } from "./viewTypes";
import { handleActionKeyDown } from "./viewTypes";

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
            ←
          </button>
          <div className="profile-pic">
            <img src={vm.contactProfile.avatarUrl} alt={vm.contactProfile.name} />
          </div>
          <div className="contact-info">
            <h2>{vm.contactProfile.name}</h2>
            <span>{vm.contactProfile.statusText}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => vm.setCalendarOpen(true)} type="button" aria-label="Calendar">
            📅
          </button>
          <button className="icon-btn" onClick={vm.startCall} type="button" aria-label="Call">
            📞
          </button>
          <button className="icon-btn" onClick={() => vm.setShowSearch(true)} type="button" aria-label="Search">
            🔎
          </button>
          <div>
            <button
              className="icon-btn"
              onClick={(event) => {
                event.stopPropagation();
                vm.setAttachSheetOpen(false);
                vm.setChatMenuOpen((prev) => !prev);
              }}
              id="menu-trigger"
              type="button"
              aria-label="Menu"
            >
              ⋮
            </button>

            <div className={`dropdown-menu ${vm.chatMenuOpen ? "active" : ""}`} id="chat-menu">
              <button
                id="install-app-btn"
                style={{ display: vm.deferredPrompt ? "flex" : "none" }}
                onClick={vm.triggerInstall}
                type="button"
              >
                ⬇ Install App
              </button>
              <button onClick={vm.openHistory} type="button">
                🕘 Call History
              </button>
              <button onClick={vm.showMedia} type="button">
                🖼 Media, Links, Docs
              </button>
            </div>
          </div>
        </div>

        <div className="search-bar-container" id="search-bar-container">
          <button className="icon-btn" onClick={() => vm.setShowSearch(false)} type="button">
            ←
          </button>
          <input type="text" placeholder="Search..." id="search-input" className="search-input" />
          <button className="icon-btn" onClick={() => vm.setShowSearch(false)} type="button">
            ✕
          </button>
        </div>
      </header>

      <main className="chat-canvas" id="message-container">
        {!vm.localDataReady ? <div className="message bot-msg system-msg">Loading local messages...</div> : null}

        {vm.chatMessages.map((message) => {
          if (message.kind === "system") {
            return (
              <div key={message.id} className="message bot-msg system-msg">
                {message.text}
              </div>
            );
          }

          if (message.kind === "doc") {
            return (
              <button
                key={message.id}
                className={`message ${message.role === "bot" ? "bot-msg" : "patient-msg"} doc-message`}
                onClick={() => vm.openDocumentByName(message.fileName)}
                type="button"
              >
                <div className="doc-icon">📄</div>
                <div className="doc-info">
                  <strong>{message.fileName}</strong>
                  <div className="doc-meta">{message.meta}</div>
                </div>
                <span className="time">{message.time}</span>
              </button>
            );
          }

          if (message.kind === "image") {
            return (
              <div key={message.id} className={`message ${message.role === "bot" ? "bot-msg" : "patient-msg"} image-message`}>
                <img src={message.imageUrl} alt="Shared" onClick={vm.openImage} />
                {message.caption ? <p>{message.caption}</p> : null}
                <span className="time">{message.time}</span>
              </div>
            );
          }

          return (
            <div key={message.id} className={`message ${message.role === "bot" ? "bot-msg" : "patient-msg"}`}>
              {message.text}
              <span className="time">{message.time}</span>
            </div>
          );
        })}
      </main>

      <footer className="chat-input-area glassmorphism">
        <div>
          <button
            className="icon-btn attachment-btn"
            id="attach-trigger"
            onClick={(event) => {
              event.stopPropagation();
              vm.setChatMenuOpen(false);
              vm.setAttachSheetOpen((prev) => !prev);
            }}
            type="button"
            aria-label="Attach"
          >
            ＋
          </button>
          <div className={`attachment-sheet ${vm.attachSheetOpen ? "active" : ""}`} id="attach-sheet">
            <div className="attach-grid">
              <input
                type="file"
                id="camera-input"
                accept="image/*"
                capture="environment"
                className="input-hidden"
                onChange={(event) => vm.handleFileSelect("Photo", event)}
              />
              <input
                type="file"
                id="gallery-input"
                accept="image/*,video/*"
                className="input-hidden"
                onChange={(event) => vm.handleFileSelect("Gallery Media", event)}
              />
              <input
                type="file"
                id="document-input"
                accept=".pdf,.doc,.docx,.txt"
                className="input-hidden"
                onChange={(event) => vm.handleFileSelect("Document", event)}
              />

              <button className="attach-item gallery" onClick={vm.openGalleryPicker} type="button">
                <div className="icon-circle">🖼</div>
                <span>Gallery</span>
              </button>
              <button className="attach-item camera" onClick={vm.openCameraPicker} type="button">
                <div className="icon-circle">📷</div>
                <span>Camera</span>
              </button>
              <button className="attach-item document" onClick={vm.openDocumentPicker} type="button">
                <div className="icon-circle">📄</div>
                <span>Document</span>
              </button>
            </div>
          </div>
        </div>

        <textarea
          placeholder="Message..."
          rows={1}
          id="chat-input"
          value={vm.messageText}
          onChange={(event) => vm.setMessageText(event.target.value)}
        />

        <div className="input-actions">
          <button className="icon-btn camera-btn" onClick={vm.openCamera} type="button" aria-label="Open camera">
            📷
          </button>
          <button className="icon-btn voice-btn primary-bg" id="voice-send-btn" onClick={vm.sendMessageFromInput} type="button">
            {vm.voiceSendIcon}
          </button>
        </div>
      </footer>
    </div>
  );
}
