"use client";

/* eslint-disable @next/next/no-img-element */

import { RefreshCw, SendHorizontal, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CAPTURE_PREVIEW_URL } from "../constants";
import type { CareChatViewProps } from "./viewTypes";
import { handleImageError } from "./viewTypes";

export function CameraView({ vm }: CareChatViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasMediaDevices, setHasMediaDevices] = useState(true);

  useEffect(() => {
    setHasMediaDevices(typeof navigator !== "undefined" && !!navigator.mediaDevices);
  }, []);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (vm.activeView === "camera" && !vm.cameraCaptured) {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: "environment" } })
          .then((s) => {
            activeStream = s;
            if (videoRef.current) {
              videoRef.current.srcObject = s;
            }
          })
          .catch((err) => console.error("Camera permissions not granted or failed:", err));
      } else {
        console.error("Camera access requires a secure context (HTTPS/localhost).");
      }
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
            {!hasMediaDevices && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-400 bg-zinc-950/95 z-20">
                <p className="font-semibold text-lg text-white mb-2">Camera Unavailable</p>
                <p className="text-sm max-w-xs mb-4">
                  Camera access requires a Secure Context (HTTPS or localhost).
                </p>
                <div className="text-xs text-zinc-500 max-w-xs bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <p className="mb-2 font-medium text-zinc-400">To test on a mobile device/LAN:</p>
                  <ol className="list-decimal pl-4 text-left space-y-1">
                    <li>Open Chrome on your testing device</li>
                    <li>Go to <code className="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 select-all font-mono">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></li>
                    <li>Enable the flag and add <code className="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 font-mono">{typeof window !== "undefined" ? window.location.origin : "http://192.168.1.43:3000"}</code> into the text box</li>
                    <li>Relaunch Chrome on the device</li>
                  </ol>
                </div>
              </div>
            )}
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
