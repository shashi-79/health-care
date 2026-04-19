"use client";

import { X } from "lucide-react";
import type { CareChatViewProps } from "./viewTypes";
import { handleActionKeyDown } from "./viewTypes";

export function AddScheduleOverlay({ vm }: CareChatViewProps) {
  return (
    <div
      className={`popup-overlay ${vm.addScheduleOpen ? "active" : ""}`}
      id="add-schedule-view"
      onClick={() => vm.setAddScheduleOpen(false)}
      onKeyDown={(event) => handleActionKeyDown(event, () => vm.setAddScheduleOpen(false))}
      role="button"
      tabIndex={0}
    >
      <div className="popup-content schedule-popup" onClick={(event) => event.stopPropagation()}>
        <header className="doc-header shadow-sm popup-header">
          <div className="popup-header-inner">
            <h2>New Schedule</h2>
            <button className="icon-btn" onClick={() => vm.setAddScheduleOpen(false)} type="button">
              <X />
            </button>
          </div>
        </header>

        <div className="schedule-form">
          <label>
            <span>Schedule Type</span>
            <select value={vm.scheduleForm.scheduleType} onChange={(event) => vm.setScheduleFormField("scheduleType", event.target.value)}>
              <option>Medicine Time</option>
              <option>Consultancy Time</option>
              <option>Call Time</option>
            </select>
          </label>

          <label>
            <span>Title (e.g. Paracetamol)</span>
            <input
              type="text"
              placeholder="Enter schedule name"
              value={vm.scheduleForm.title}
              onChange={(event) => vm.setScheduleFormField("title", event.target.value)}
            />
          </label>

          <div className="schedule-grid">
            <label>
              <span>Date</span>
              <input type="date" value={vm.scheduleForm.date} onChange={(event) => vm.setScheduleFormField("date", event.target.value)} />
            </label>
            <label>
              <span>Time</span>
              <input type="time" value={vm.scheduleForm.time} onChange={(event) => vm.setScheduleFormField("time", event.target.value)} />
            </label>
          </div>

          <label>
            <span>Duration/Days</span>
            <input
              type="text"
              placeholder="e.g. 5 days"
              value={vm.scheduleForm.duration}
              onChange={(event) => vm.setScheduleFormField("duration", event.target.value)}
            />
          </label>

          <label>
            <span>Notes / Disease Purpose</span>
            <textarea
              rows={2}
              placeholder="Relevant context..."
              value={vm.scheduleForm.notes}
              onChange={(event) => vm.setScheduleFormField("notes", event.target.value)}
            />
          </label>

          <button className="save-btn" onClick={vm.saveSchedule} type="button">
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
