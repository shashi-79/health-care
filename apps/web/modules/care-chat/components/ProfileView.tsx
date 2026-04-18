"use client";

/* eslint-disable @next/next/no-img-element */

import type { CareChatViewProps } from "./viewTypes";

export function ProfileView({ vm }: CareChatViewProps) {
  return (
    <div className={`view sliding-view bg-light ${vm.activeView === "profile" ? "active" : "hidden"}`}>
      <header className="history-header shadow-sm light-header">
        <div className="header-left">
          <button className="icon-btn" onClick={vm.closeProfile} type="button">
            ←
          </button>
          <h2>Contact info</h2>
        </div>
        <div className="header-actions">
          <button className="icon-btn" type="button">
            ⋮
          </button>
        </div>
      </header>

      <div className="profile-hero">
        <img src={vm.contactProfile.avatarUrl} alt={vm.contactProfile.name} />
        <h2>{vm.contactProfile.name}</h2>
        <span>{vm.contactProfile.phone}</span>
      </div>

      <section className="profile-card">
        <h3>Patient Details</h3>
        <div className="detail-row">
          <span>👤</span>
          <div>
            <small>Name</small>
            <strong>{vm.contactProfile.name}</strong>
          </div>
        </div>
        <div className="detail-row">
          <span>📅</span>
          <div>
            <small>DOB & Age</small>
            <strong>
              {vm.contactProfile.dobLabel} ({vm.contactProfile.ageLabel})
            </strong>
          </div>
        </div>
        <div className="detail-row">
          <span>🩺</span>
          <div className="detail-grid-two">
            <div>
              <small>Weight</small>
              <strong>{vm.contactProfile.weightLabel}</strong>
            </div>
            <div>
              <small>Height</small>
              <strong>{vm.contactProfile.heightLabel}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="profile-card">
        <div className="detail-row medical-history">
          <span>❤️</span>
          <div>
            <small>Medical History</small>
            <p>{vm.contactProfile.medicalHistory}</p>
          </div>
        </div>
      </section>

      <section className="profile-card media-nav-card">
        <button className="profile-nav-row" onClick={vm.showMedia} type="button">
          <div>
            <span>Media, links, and docs</span>
            <small>
              {vm.mediaImages.length + vm.mediaDocs.length + vm.mediaLinks.length}
              {" "}
              items available
            </small>
          </div>
          <span>›</span>
        </button>
      </section>
    </div>
  );
}
