"use client";

import type { CareChatViewProps } from "./viewTypes";
import { handleActionKeyDown } from "./viewTypes";

export function CalendarOverlay({ vm }: CareChatViewProps) {
  return (
    <div
      className={`popup-overlay ${vm.calendarOpen ? "active" : ""}`}
      id="calendar-view"
      onClick={() => vm.setCalendarOpen(false)}
      onKeyDown={(event) => handleActionKeyDown(event, () => vm.setCalendarOpen(false))}
      role="button"
      tabIndex={0}
    >
      <div className="popup-content" onClick={(event) => event.stopPropagation()}>
        <header className="doc-header shadow-sm popup-header">
          <div className="popup-header-inner">
            <h2>Schedule</h2>
            <button className="icon-btn" onClick={() => vm.setCalendarOpen(false)} type="button">
              ✕
            </button>
          </div>
        </header>

        <div className="date-selector">
          {vm.calendarDatePills.map((pill) => (
            <div key={pill.key} className={`date-pill ${pill.isActive ? "active" : ""}`}>
              {pill.label}
            </div>
          ))}
        </div>

        <div className="calendar-body">
          <div className="agenda-container">
            {vm.groupedSchedules.map((group) => (
              <div key={`${group.dateNumber}-${group.dayLabel}`} className="agenda-day">
                <div className="agenda-date">
                  <span>{group.dateNumber}</span>
                  <small>{group.dayLabel}</small>
                </div>
                <div className="agenda-events">
                  {group.items.map((item) => (
                    <div key={item.id} className={`event-item event-${item.tone}`}>
                      <span>{item.scheduleType.includes("Medicine") ? "💊" : item.scheduleType.includes("Call") ? "🕒" : "🔔"}</span>
                      <div>
                        <h4>{item.title}</h4>
                        <small>
                          {item.time}
                          {item.notes ? ` • ${item.notes}` : ""}
                        </small>
                      </div>
                      <input
                        type="checkbox"
                        checked={item.status === "done"}
                        onChange={(event) => vm.toggleScheduleStatus(item.id, event.target.checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {vm.groupedSchedules.length === 0 ? <p className="table-intro">No schedules yet. Add one using +.</p> : null}
          </div>
        </div>

        <button className="fab-btn" onClick={() => vm.setAddScheduleOpen(true)} type="button">
          ＋
        </button>
      </div>
    </div>
  );
}
