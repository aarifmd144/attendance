import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  isSentByMe?: boolean;
  initialDuration?: number;
}

export default function AudioPlayer({ src, isSentByMe = false, initialDuration = 0 }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);

  useEffect(() => {
    if (initialDuration && initialDuration > 0) {
      setDuration(initialDuration);
    }
  }, [initialDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      } else if (initialDuration && initialDuration > 0) {
        setDuration(initialDuration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Fallback: if duration was Infinity/0 but currentTime is increasing, update duration if initialDuration wasn't set
      if ((!duration || duration === 0) && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src, initialDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const seekTo = Number(e.target.value);
    audio.currentTime = seekTo;
    setCurrentTime(seekTo);
  };

  const formatSecs = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec) || sec < 0) return '00:00';
    const totalSecs = Math.round(sec);
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-2.5 p-2 rounded-2xl min-w-[210px] sm:min-w-[260px] select-none ${
        isSentByMe ? 'bg-black/15 text-white' : 'bg-slate-100/90 text-slate-800'
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 ${
          isSentByMe
            ? 'bg-white text-primary-600 hover:bg-slate-100'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      {/* Waveform / Seek bar and time */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="relative flex items-center">
          {/* Custom Range Slider */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-300/60 accent-primary-600"
          />
        </div>

        <div
          className={`flex items-center justify-between text-[10px] font-mono leading-none ${
            isSentByMe ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          <span>{formatSecs(currentTime)}</span>
          <span className="flex items-center gap-1">
            <Volume2 className="w-2.5 h-2.5 opacity-60" />
            {formatSecs(duration || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
