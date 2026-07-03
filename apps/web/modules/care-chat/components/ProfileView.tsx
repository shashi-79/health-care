"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Edit, HeartPulse, Ruler, UserRound, X } from "lucide-react";
import type { CareChatViewProps } from "./viewTypes";
import { handleImageError } from "./viewTypes";

export function ProfileView({ vm }: CareChatViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(vm.contactProfile.name);
  const [dobLabel, setDobLabel] = useState(vm.contactProfile.dobLabel);
  const [ageLabel, setAgeLabel] = useState(vm.contactProfile.ageLabel);
  const [weightLabel, setWeightLabel] = useState(vm.contactProfile.weightLabel);
  const [heightLabel, setHeightLabel] = useState(vm.contactProfile.heightLabel);
  const [medicalHistory, setMedicalHistory] = useState(vm.contactProfile.medicalHistory);

  const handleStartEdit = () => {
    setName(vm.contactProfile.name);
    setDobLabel(vm.contactProfile.dobLabel);
    setAgeLabel(vm.contactProfile.ageLabel);
    setWeightLabel(vm.contactProfile.weightLabel);
    setHeightLabel(vm.contactProfile.heightLabel);
    setMedicalHistory(vm.contactProfile.medicalHistory);
    setIsEditing(true);
  };

  const handleSave = () => {
    vm.updateContactProfile({
      name: name.trim(),
      dobLabel: dobLabel.trim(),
      ageLabel: ageLabel.trim(),
      weightLabel: weightLabel.trim(),
      heightLabel: heightLabel.trim(),
      medicalHistory: medicalHistory.trim()
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(vm.contactProfile.name);
    setDobLabel(vm.contactProfile.dobLabel);
    setAgeLabel(vm.contactProfile.ageLabel);
    setWeightLabel(vm.contactProfile.weightLabel);
    setHeightLabel(vm.contactProfile.heightLabel);
    setMedicalHistory(vm.contactProfile.medicalHistory);
    setIsEditing(false);
  };

  return (
    <div className={`view sliding-view bg-light ${vm.activeView === "profile" ? "active" : "hidden"}`}>
      <header className="history-header shadow-sm light-header">
        <div className="header-left">
          <button className="icon-btn" onClick={vm.closeProfile} type="button">
            <ArrowLeft />
          </button>
          <h2>Patient Profile</h2>
        </div>
        <div className="header-actions">
          {isEditing ? (
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="icon-btn text-red-500" onClick={handleCancel} type="button" aria-label="Cancel editing">
                <X />
              </button>
              <button className="icon-btn text-emerald-600" onClick={handleSave} type="button" aria-label="Save profile">
                <Check />
              </button>
            </div>
          ) : (
            <button className="icon-btn" onClick={handleStartEdit} type="button" aria-label="Edit profile">
              <Edit size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="profile-hero">
        <div className="profile-hero-avatar">
          <img src={vm.contactProfile.avatarUrl || undefined} alt={`${vm.contactProfile.name} profile avatar`} onError={handleImageError} />
        </div>
        <h2>{vm.contactProfile.name || "Patient Profile"}</h2>
        <span>{vm.contactProfile.phone || "No phone added"}</span>
      </div>

      <section className="profile-card">
        <h3>Patient Details</h3>
        <div className="detail-row">
          <span>
            <UserRound />
          </span>
          <div style={{ width: "100%" }}>
            <small>Name</small>
            {isEditing ? (
              <input
                type="text"
                className="profile-edit-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Patient name"
              />
            ) : (
              <strong>{vm.contactProfile.name || "Not set"}</strong>
            )}
          </div>
        </div>
        <div className="detail-row">
          <span>
            <CalendarDays />
          </span>
          <div style={{ width: "100%" }}>
            <small>DOB & Age</small>
            {isEditing ? (
              <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: "4px" }}>
                <input
                  type="text"
                  className="profile-edit-input"
                  value={dobLabel}
                  onChange={(e) => setDobLabel(e.target.value)}
                  placeholder="DOB (e.g. 1990-01-01)"
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  className="profile-edit-input"
                  value={ageLabel}
                  onChange={(e) => setAgeLabel(e.target.value)}
                  placeholder="Age"
                  style={{ width: "80px" }}
                />
              </div>
            ) : (
              <strong>
                {vm.contactProfile.dobLabel || vm.contactProfile.ageLabel ? (
                  `${vm.contactProfile.dobLabel} ${vm.contactProfile.ageLabel ? `(${vm.contactProfile.ageLabel})` : ""}`.trim()
                ) : (
                  "Not set"
                )}
              </strong>
            )}
          </div>
        </div>
        <div className="detail-row">
          <span>
            <Ruler />
          </span>
          <div style={{ width: "100%" }}>
            {isEditing ? (
              <div className="detail-grid-two">
                <div>
                  <small>Weight</small>
                  <input
                    type="text"
                    className="profile-edit-input"
                    value={weightLabel}
                    onChange={(e) => setWeightLabel(e.target.value)}
                    placeholder="e.g. 70 kg"
                  />
                </div>
                <div>
                  <small>Height</small>
                  <input
                    type="text"
                    className="profile-edit-input"
                    value={heightLabel}
                    onChange={(e) => setHeightLabel(e.target.value)}
                    placeholder="e.g. 175 cm"
                  />
                </div>
              </div>
            ) : (
              <div className="detail-grid-two">
                <div>
                  <small>Weight</small>
                  <strong>{vm.contactProfile.weightLabel || "Not set"}</strong>
                </div>
                <div>
                  <small>Height</small>
                  <strong>{vm.contactProfile.heightLabel || "Not set"}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="profile-card">
        <div className="detail-row medical-history">
          <span>
            <HeartPulse />
          </span>
          <div style={{ width: "100%" }}>
            <small>Medical History</small>
            {isEditing ? (
              <textarea
                className="profile-edit-textarea"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Enter conditions, allergies, surgeries, etc."
                rows={3}
              />
            ) : (
              <p>{vm.contactProfile.medicalHistory || "No medical history recorded."}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
