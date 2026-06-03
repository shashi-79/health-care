"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ArrowLeft,
  Link2,
  MoreVertical,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Search,
  Trash2
} from "lucide-react";
import type { CareChatViewProps } from "./viewTypes";
import { handleActionKeyDown, handleImageError } from "./viewTypes";

export function HistoryView({ vm }: CareChatViewProps) {
  return (
    <div className={`view sliding-view bg-light ${vm.activeView === "history" ? "active" : "hidden"}`}>
      <header className="history-header shadow-sm dark-header">
        <div className="header-left">
          <button className="icon-btn text-white" onClick={vm.closeHistory} type="button">
            <ArrowLeft />
          </button>
          <h2>Calls</h2>
        </div>
        <div className="header-actions">
          <button className="icon-btn text-white" type="button">
            <Search />
          </button>
          <button className="icon-btn text-white" type="button">
            <MoreVertical />
          </button>
        </div>
      </header>

      <div
        className="create-call-link"
        onClick={vm.generateCallLink}
        onKeyDown={(event) => handleActionKeyDown(event, vm.generateCallLink)}
        role="button"
        tabIndex={0}
      >
        <div className="link-badge">
          <Link2 />
        </div>
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
              <img src={item.avatar} className="avatar" alt={`Call with ${item.name}`} onError={handleImageError} />
              <div className="history-info">
                <h3 className={item.type === "missed" ? "text-red" : ""}>{item.name}</h3>
                <div className="history-meta">
                  <span className={`call-${item.type}`}>
                    {item.type === "in" ? <PhoneIncoming size={14} /> : null}
                    {item.type === "out" ? <PhoneOutgoing size={14} /> : null}
                    {item.type === "missed" ? <PhoneMissed size={14} /> : null}
                  </span>
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
                  <Phone size={16} />
                </button>
                <button
                  className="icon-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    vm.deleteSingleHistory(item.id);
                  }}
                  type="button"
                >
                  <Trash2 size={16} />
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
        ) : (
          <button className="icon-btn text-red" id="bulk-delete-all-btn" onClick={vm.clearAllHistoryCalls} type="button">
            Clear All
          </button>
        )}
      </div>

      <button className="fab-btn call-fab" onClick={vm.startCall} type="button">
        <PhoneCall />
      </button>
    </div>
  );
}
