"use client";

/* eslint-disable @next/next/no-img-element */

import { RefreshCw, SendHorizontal, X, Zap } from "lucide-react";
import { CAPTURE_PREVIEW_URL } from "../constants";
import type { CareChatViewProps } from "./viewTypes";
import { handleImageError } from "./viewTypes";

export function CameraView({ vm }: CareChatViewProps) {
  return (
    <div className={`view fullscreen-view bg-black ${vm.activeView === "camera" ? "active" : "hidden"}`}>
      <header className="camera-header">
        <button className="icon-btn text-white" onClick={vm.closeCamera} type="button">
          <X />
        </button>
        <button className="icon-btn text-white" type="button">
          <Zap />
        </button>
      </header>

      <div className="camera-body">
        {!vm.cameraCaptured ? (
          <div className="viewfinder" id="viewfinder">
            <p className="text-white">Camera Viewfinder Active</p>
          </div>
        ) : (
          <div className="image-preview" id="image-preview">
            <img src={CAPTURE_PREVIEW_URL} alt="Captured preview" onError={handleImageError} />
          </div>
        )}
      </div>

      {!vm.cameraCaptured ? (
        <div className="camera-controls" id="camera-controls">
          <button className="shutter-btn" onClick={vm.captureImage} type="button" aria-label="Capture image" />
          <button className="icon-btn text-white refresh-btn" type="button">
            <RefreshCw />
          </button>
        </div>
      ) : (
        <div className="caption-controls" id="caption-controls">
          <div className="caption-input-wrapper">
            <input
              type="text"
              placeholder="Add a caption..."
              id="caption-input"
              value={vm.cameraCaption}
              onChange={(event) => vm.setCameraCaption(event.target.value)}
            />
            <button className="send-img-btn" onClick={vm.sendCapturedImage} type="button">
              <SendHorizontal />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
