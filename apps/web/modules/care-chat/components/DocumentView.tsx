"use client";

import { Fragment } from "react";

import type { CareChatViewProps } from "./viewTypes";

export function DocumentView({ vm }: CareChatViewProps) {
  return (
    <div className={`view sliding-view ${vm.activeView === "document" ? "active" : "hidden"}`}>
      <header className="doc-header shadow-sm">
        <button className="icon-btn" onClick={vm.closeDocument} type="button">
          ←
        </button>
        <h2>{vm.activeDocument.title}</h2>
        <button className="icon-btn" type="button">
          ↗
        </button>
      </header>
      <div className="split-view">
        <div className="pdf-container top-summary">
          <div className="pdf-summary-row">
            <span className="pdf-summary-icon">📄</span>
            <div>
              <h3>{vm.activeDocument.summaryTitle}</h3>
            </div>
          </div>
        </div>
        <div className="data-container data-container-expanded">
          <div className="tab-header">
            <span className="active">Answer...</span>
            <span>Tabular form</span>
            <span>.PDF</span>
          </div>
          <div className="tabular-data">
            <p className="table-intro">{vm.activeDocument.summaryBody}</p>
            <div className="mock-table">
              <div>Test</div>
              <div>Result</div>
              <div>Range</div>
              {vm.activeDocument.tableRows.map((row) => (
                <Fragment key={row.label}>
                  <div>{row.label}</div>
                  <div className={row.isAlert ? "alert" : ""}>{row.result}</div>
                  <div>{row.range}</div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
