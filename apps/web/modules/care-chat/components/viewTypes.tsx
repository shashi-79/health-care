import type { KeyboardEvent, SyntheticEvent } from "react";
import type { CareChatViewModel } from "../useCareChatController";

export type CareChatViewProps = {
  vm: CareChatViewModel;
};

export function handleActionKeyDown(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

const FALLBACK_IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23dfe3eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236f7887' font-family='Arial' font-size='16'%3EImage%3C/text%3E%3C/svg%3E";

export function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const target = event.currentTarget;
  if (target.dataset.fallbackApplied === "1") {
    return;
  }

  target.dataset.fallbackApplied = "1";
  target.src = FALLBACK_IMAGE_DATA_URI;
}

export function LetterAvatar({
  name,
  size = 40,
  fontSize,
  style = {}
}: {
  name: string;
  size?: number | string;
  fontSize?: number | string;
  style?: React.CSSProperties;
}) {
  const firstLetter = name ? name.trim().charAt(0).toUpperCase() : "U";
  
  const colors = [
    "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)", // Coral Red
    "linear-gradient(135deg, #4E65FF 0%, #92EFFD 100%)", // Ocean Blue
    "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", // Emerald Green
    "linear-gradient(135deg, #fc00ff 0%, #00dbde 100%)", // Purple/Cyan
    "linear-gradient(135deg, #f12711 0%, #f5af19 100%)", // Sunset Orange
    "linear-gradient(135deg, #8A2387 0%, #E94057 100%, #F27121 100%)", // Vibrant Pink
  ];
  
  const charCode = firstLetter.charCodeAt(0) || 0;
  const background = colors[charCode % colors.length];

  const computedWidth = typeof size === "number" ? `${size}px` : size;
  const computedHeight = typeof size === "number" ? `${size}px` : size;
  const computedFontSize = fontSize
    ? (typeof fontSize === "number" ? `${fontSize}px` : fontSize)
    : (typeof size === "number" ? `${Math.floor(size * 0.45)}px` : "16px");

  return (
    <div
      style={{
        width: computedWidth,
        height: computedHeight,
        borderRadius: "50%",
        background: background,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: computedFontSize,
        userSelect: "none",
        boxShadow: "inset 0 2px 4px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.1)",
        fontFamily: 'Inter, "Segoe UI", sans-serif',
        flexShrink: 0,
        ...style
      }}
    >
      {firstLetter}
    </div>
  );
}
