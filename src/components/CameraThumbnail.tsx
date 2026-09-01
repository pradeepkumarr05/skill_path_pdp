import { useEffect, useRef, useState } from 'react';
import { Camera, VideoCameraSlash } from '@phosphor-icons/react';

interface CameraThumbnailProps {
  stream?: MediaStream;
  active: boolean;
  title?: string;
  detail?: string;
}

export function CameraThumbnail({
  stream,
  active,
  title = 'Camera preview',
  detail = 'Live proctoring thumbnail',
}: CameraThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || !active) {
      setPlaying(false);
      return;
    }

    video.srcObject = stream;
    const playPromise = video.play();
    if (playPromise) {
      playPromise
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }

    return () => {
      video.pause();
      video.srcObject = null;
      setPlaying(false);
    };
  }, [active, stream]);

  const liveTrack = stream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;
  const isLive = active && liveTrack && playing;

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-skillpath-night text-skillpath-cream shadow-soft" data-testid="camera-thumbnail">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="text-xs font-bold text-skillpath-cream/58">{detail}</p>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${isLive ? 'bg-skillpath-teal text-skillpath-night' : 'bg-white/8 text-skillpath-cream/70'}`}>
          {isLive ? <Camera className="h-5 w-5" weight="bold" aria-hidden="true" /> : <VideoCameraSlash className="h-5 w-5" weight="bold" aria-hidden="true" />}
        </span>
      </div>
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} className={`h-full w-full object-cover ${isLive ? 'opacity-100' : 'opacity-0'}`} autoPlay muted playsInline />
        {!isLive ? (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div>
              <VideoCameraSlash className="mx-auto h-8 w-8 text-skillpath-cream/56" weight="bold" aria-hidden="true" />
              <p className="mt-3 text-sm font-black">Camera thumbnail unavailable</p>
              <p className="mt-1 text-xs font-bold leading-5 text-skillpath-cream/58">Grant camera access before a live assessment or learning session.</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
