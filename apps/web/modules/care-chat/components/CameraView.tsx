"use client";

/* eslint-disable @next/next/no-img-element */

import { RefreshCw, SendHorizontal, X, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { CAPTURE_PREVIEW_URL } from "../constants";
import type { CareChatViewProps } from "./viewTypes";
import { handleImageError } from "./viewTypes";

export function CameraView({ vm }: CareChatViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (vm.activeView === "camera" && !vm.cameraCaptured) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          activeStream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => console.error("Camera permissions not granted or failed:", err));
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [vm.activeView, vm.cameraCaptured]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.85);
        if (vm.captureImage) {
          vm.captureImage(base64);
        }
      }
    }
  };

  const previewSource = vm.capturedImageBase64 || CAPTURE_PREVIEW_URL;

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

      <div className="camera-body relative h-full">
        {!vm.cameraCaptured ? (
          <div className="viewfinder absolute inset-0 z-0 bg-zinc-900" id="viewfinder">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover" 
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <div className="image-preview absolute inset-0 z-0" id="image-preview">
            <img src={previewSource} alt="Captured preview" onError={handleImageError} className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {!vm.cameraCaptured ? (
        <div className="camera-controls absolute bottom-8 w-full z-10 flex justify-center" id="camera-controls">
          <button 
            className="shutter-btn w-16 h-16 rounded-full border-4 border-white bg-white/20 active:bg-white/50" 
            onClick={handleCapture} 
            type="button" 
            aria-label="Capture image" 
          />
          <button className="icon-btn text-white absolute right-8 bottom-3" type="button">
            <RefreshCw />
          </button>
        </div>
      ) : (
        <div className="caption-controls absolute bottom-0 w-full z-10 bg-black/60 p-4 pb-8 backdrop-blur" id="caption-controls">
          <div className="caption-input-wrapper flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a caption..."
              id="caption-input"
              value={vm.cameraCaption}
              onChange={(event) => vm.setCameraCaption(event.target.value)}
              className="flex-1 bg-zinc-800 text-white rounded-full px-4 py-3 outline-none"
            />
            <button 
              className="send-img-btn bg-emerald-500 text-white p-3 rounded-full flex-shrink-0" 
              onClick={vm.sendCapturedImage} 
              type="button"
            >
              <SendHorizontal />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
