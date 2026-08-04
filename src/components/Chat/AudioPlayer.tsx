import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { useAudioStore } from '../../store/useAudioStore';

interface AudioPlayerProps {
  id?: string;
  src: string;
  durationSeconds?: number;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ id, src, durationSeconds }) => {
  const activeAudioId = useAudioStore((state) => state.activeAudioId);
  const setActiveAudioId = useAudioStore((state) => state.setActiveAudioId);
  const playbackSpeed = useAudioStore((state) => state.playbackSpeed);
  const setPlaybackSpeed = useAudioStore((state) => state.setPlaybackSpeed);

  const audioId = useRef(id || `audio-${Math.random().toString(36).substr(2, 9)}`).current;
  const isCurrentlyActive = activeAudioId === audioId;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync playback rate with global speed state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Pause if another audio becomes active
  useEffect(() => {
    if (!isCurrentlyActive && isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isCurrentlyActive, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (activeAudioId === audioId) {
        setActiveAudioId(null);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src, audioId, activeAudioId, setActiveAudioId]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setActiveAudioId(null);
    } else {
      setActiveAudioId(audioId);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playbackSpeed === 1) setPlaybackSpeed(1.5);
    else if (playbackSpeed === 1.5) setPlaybackSpeed(2);
    else setPlaybackSpeed(1);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const waveformHeights = [40, 80, 50, 90, 60, 30, 70, 90, 40, 60, 80, 50, 30, 70, 50, 80];

  return (
    <div className="flex items-center gap-2.5 p-2 bg-white/70 dark:bg-stone-800/70 rounded-2xl w-full max-w-xs shadow-xs border border-stone-200/50 dark:border-stone-700/50">
      <audio ref={audioRef} src={src} preload="auto" />
      
      <button
        type="button"
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale hover:bg-[#B34757] transition-colors"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Interactive Click-to-Seek Waveform */}
        <div
          onClick={handleSeek}
          className="flex items-center gap-0.5 h-4 cursor-pointer py-1 group"
          title="Click to seek"
        >
          {waveformHeights.map((h, i) => {
            const barProgress = (i / waveformHeights.length) * (duration || 1);
            const isPassed = currentTime >= barProgress;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-150 group-hover:scale-y-110 ${
                  isPassed ? 'bg-[#C95565]' : 'bg-stone-300 dark:bg-stone-600'
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-semibold text-stone-500 dark:text-stone-400">
          <span>{formatSeconds(currentTime)}</span>
          <span>{duration > 0 ? formatSeconds(duration) : '0:05'}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleSpeed}
          className="px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-700/80 text-[10px] font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-300 active-scale"
          title="Playback speed"
        >
          {playbackSpeed}x
        </button>

        <a
          href={src}
          download="ivy_voice_note.webm"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 active-scale"
          title="Download voice note"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
