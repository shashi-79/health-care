

export const CAPTURE_PREVIEW_URL =
  "https://images.unsplash.com/photo-1542736667-069246bdbc6d?auto=format&fit=crop&w=400&q=80";

export function formatCallDuration(seconds: number) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}
