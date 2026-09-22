import { useEffect, useRef } from 'react';
import type { AssessmentAccessGrant } from '../types/assessment';

// Frames remain local. Motion events are review signals, not cheating verdicts.
export function CameraMonitor({ access, active, report }: { access: AssessmentAccessGrant; active: boolean; report: (type: string, detail: string) => void }) {
  const reportRef = useRef(report);
  reportRef.current = report;
  useEffect(() => {
    if (!active) return;
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.srcObject = access.cameraStream || null;
    void video.play().catch(() => {});
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let previous: Uint8ClampedArray | undefined;
    let motionFrames = 0; let darkFrames = 0;
    const reported = new Map<string, number>();
    function flag(type: string, detail: string) {
      const cooldown = type === 'camera_motion' || type === 'camera_obscured' ? 30000 : 1000;
      if (Date.now() - (reported.get(type) || 0) < cooldown) return;
      reported.set(type, Date.now()); reportRef.current(type, detail);
    }
    const interval = window.setInterval(() => {
      const camera = access.cameraStream?.getVideoTracks()[0];
      const screen = access.screenStream?.getVideoTracks()[0];
      if (!camera || camera.readyState !== 'live' || !camera.enabled) flag('camera_track_ended', 'Camera stream is unavailable.');
      if (!screen || screen.readyState !== 'live' || !screen.enabled) flag('screen_track_ended', 'Screen sharing is unavailable.');
      if (!document.fullscreenElement) flag('fullscreen_exit', 'Fullscreen is no longer active.');
      if (!context || video.readyState < 2) return;
      context.drawImage(video, 0, 0, 64, 48);
      const pixels = context.getImageData(0, 0, 64, 48).data;
      let brightness = 0; let changed = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        brightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        if (previous && Math.abs(pixels[i] - previous[i]) + Math.abs(pixels[i + 1] - previous[i + 1]) + Math.abs(pixels[i + 2] - previous[i + 2]) > 100) changed++;
      }
      motionFrames = changed / (64 * 48) > 0.4 ? motionFrames + 1 : 0;
      darkFrames = brightness / (64 * 48) < 8 ? darkFrames + 1 : 0;
      if (motionFrames >= 3) flag('camera_motion', 'Sustained camera motion detected; review required.');
      if (darkFrames >= 5) flag('camera_obscured', 'Camera image is persistently dark; check lighting or obstruction.');
      previous = pixels;
    }, 1000);
    return () => { clearInterval(interval); video.pause(); video.srcObject = null; };
  }, [access, active]);
  return null;
}
