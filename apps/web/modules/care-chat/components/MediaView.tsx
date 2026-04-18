"use client";

/* eslint-disable @next/next/no-img-element */

import type { CareChatViewProps } from "./viewTypes";

export function MediaView({ vm }: CareChatViewProps) {
  return (
    <div className={`view sliding-view bg-light ${vm.activeView === "media" ? "active" : "hidden"}`}>
      <header className="history-header shadow-sm dark-header">
        <div className="header-left">
          <button className="icon-btn text-white" onClick={vm.closeMedia} type="button">
            ←
          </button>
          <h2>{vm.contactProfile.name}</h2>
        </div>
      </header>

      <div className="tab-header media-tabs" id="media-tabs">
        <button
          className={`media-tab-btn ${vm.mediaTab === "media" ? "active-tab" : ""}`}
          onClick={() => vm.setMediaTab("media")}
          type="button"
        >
          Media
        </button>
        <button
          className={`media-tab-btn ${vm.mediaTab === "docs" ? "active-tab" : ""}`}
          onClick={() => vm.setMediaTab("docs")}
          type="button"
        >
          Docs
        </button>
        <button
          className={`media-tab-btn ${vm.mediaTab === "links" ? "active-tab" : ""}`}
          onClick={() => vm.setMediaTab("links")}
          type="button"
        >
          Links
        </button>
      </div>

      <div className="media-panel-wrap">
        {vm.mediaTab === "media" ? (
          <div className="media-grid">
            {vm.mediaImages.map((src) => (
              <img key={src} src={src} alt="Media" />
            ))}
            {vm.mediaImages.length === 0 ? <div className="media-video-placeholder">No media</div> : null}
          </div>
        ) : null}

        {vm.mediaTab === "docs" ? (
          <div className="media-list">
            {vm.mediaDocs.length === 0 ? <p className="table-intro">No documents shared yet.</p> : null}
            {vm.mediaDocs.map((doc) => (
              <div key={doc.id} className="media-list-item">
                <span className="doc-chip">📄</span>
                <div>
                  <strong>{doc.title}</strong>
                  <small>{doc.meta}</small>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {vm.mediaTab === "links" ? (
          <div className="media-list">
            {vm.mediaLinks.length === 0 ? <p className="table-intro">No links available.</p> : null}
            {vm.mediaLinks.map((link) => (
              <div key={link.id} className="media-list-item">
                <span className="link-chip">🔗</span>
                <div>
                  <strong>{link.title}</strong>
                  <small>{link.url}</small>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
