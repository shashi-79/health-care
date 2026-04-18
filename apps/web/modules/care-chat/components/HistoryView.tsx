"use client";

/* eslint-disable @next/next/no-img-element */

import { getHistoryIcon } from "../constants";
import type { CareChatViewProps } from "./viewTypes";
import { handleActionKeyDown } from "./viewTypes";

export function HistoryView({ vm }: CareChatViewProps) {
  return (
    <div className={`view sliding-view bg-light ${vm.activeView === "history" ? "active" : "hidden"}`}>
      <header className="history-header shadow-sm dark-header">
        <div className="header-left">
          <button className="icon-btn text-white" onClick={vm.closeHistory} type="button">
            ←
          </button>
          <h2>Calls</h2>
        </div>
        <div className="header-actions">
          <button className="icon-btn text-white" type="button">
            🔎
          </button>
          <button className="icon-btn text-white" type="button">
            ⋮
          </button>
        </div>
      </header>

      <div className="create-call-link">
        <div className="link-badge">🔗</div>
        <div>
          <h3>Create call link</h3>
          <span>Share a link for your call with {vm.contactProfile.name}</span>
        </div>
      </div>

      <h4 className="recent-title">Recent</h4>

      <div className={`history-list ${vm.selectionMode ? "selection-mode" : "normal-mode"}`} id="history-list">
        {vm.historyItems.map((item) => {
          const selected = vm.selectedCallIds.includes(item.id);
          return (
            <div
              key={item.id}
              className={`history-item ${selected ? "selected" : ""}`}
              data-id={item.id}
              onClick={() => vm.handleHistoryItemClick(item.id)}
              onKeyDown={(event) => handleActionKeyDown(event, () => vm.handleHistoryItemClick(item.id))}
              role="button"
              tabIndex={0}
            >
              <div className="checkbox" />
              <img src={item.avatar} className="avatar" alt={item.name} />
              <div className="history-info">
                <h3 className={item.type === "missed" ? "text-red" : ""}>{item.name}</h3>
                <div className="history-meta">
                  <span className={`call-${item.type}`}>{getHistoryIcon(item.type)}</span>
                  <span>{item.time}</span>
                </div>
              </div>
              <div className="history-actions">
                <button
                  className="icon-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    vm.startCall();
                  }}
                  type="button"
                >
                  📞
                </button>
                <button
                  className="icon-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    vm.deleteSingleHistory(item.id);
                  }}
                  type="button"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="history-footer-actions">
        <button className="icon-btn" id="bulk-select-btn" onClick={vm.toggleBulkSelect} type="button">
          {vm.selectionMode ? "Cancel Select" : "Select"}
        </button>
        {vm.selectionMode ? (
          <button className="icon-btn text-red" id="bulk-delete-btn" onClick={vm.deleteSelectedCalls} type="button">
            Delete Selected
          </button>
        ) : null}
      </div>

      <button className="fab-btn call-fab" onClick={vm.startCall} type="button">
        📞
      </button>
    </div>
  );
}
