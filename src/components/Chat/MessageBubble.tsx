import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Clock, FileText, Play, Pause, Pin, Star, CornerDownLeft } from 'lucide-react';
import type { Message } from '../../types';
import { formatMessageTime } from '../../utils/date';
import { isMessageFromUser } from '../../utils/message';
import { useAuthStore } from '../../store/useAuthStore';

interface MessageBubbleProps {
  message: Message;
  onLongPress: (msg: Message) => void;
  onReactionClick?: (msg: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onLongPress,
  onReactionClick,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const isMine = currentUser ? isMessageFromUser(message, currentUser.id) : false;

  // Determine if message is a voice note (by type or base64 data header)
  const isVoiceNote =
    message.message_type === 'voice' ||
    (typeof message.content === 'string' && message.content.startsWith('data:audio/'));

  // Voice note audio player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isVoiceNote && audioRef.current) {
      const audio = audioRef.current;
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handleLoadedMetadata = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };
      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [isVoiceNote, message.content]);

  const togglePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderStatus = () => {
    if (!isMine) return null;
    if (message.status === 'Sending' || message.status === 'Queued') {
      return <Clock className="w-3 h-3 text-stone-400 animate-pulse" />;
    }
    if (message.status === 'Sent') {
      return <Check className="w-3.5 h-3.5 text-stone-400" />;
    }
    if (message.status === 'Delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-stone-400" />;
    }
    return <CheckCheck className="w-3.5 h-3.5 text-[#C95565] dark:text-rose-400" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col my-1 max-w-[85%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
    >
      {/* Pinned / Starred Badge */}
      {(message.pinned || message.starred) && (
        <div className="flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500 mb-0.5 px-1">
          {message.pinned && <Pin className="w-3 h-3 text-[#C95565]" />}
          {message.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
        </div>
      )}

      {/* Main Bubble Container */}
      <div
        onClick={() => onLongPress(message)}
        className={`relative px-4 py-2.5 rounded-3xl text-sm shadow-soft transition-all duration-200 cursor-pointer active-scale select-none ${
          isMine
            ? 'bg-[#FCE8EC] text-[#501C25] dark:bg-[#4A1D28] dark:text-[#FCE8EC] rounded-tr-md'
            : 'bg-white text-stone-900 dark:bg-[#28262E] dark:text-stone-100 rounded-tl-md border border-stone-100 dark:border-stone-800'
        } ${message.deleted ? 'italic opacity-70' : ''}`}
      >
        {/* Reply Reference Box */}
        {message.reply_to_msg && !message.deleted && (
          <div
            className={`mb-2 p-2 rounded-2xl text-xs border-l-2 ${
              isMine
                ? 'bg-white/60 dark:bg-black/20 border-[#C95565]'
                : 'bg-stone-100 dark:bg-stone-800/80 border-[#C95565]'
            }`}
          >
            <p className="font-bold text-[11px] text-[#C95565] flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              <span>{message.reply_to_msg.sender_name}</span>
            </p>
            <p className="truncate text-stone-600 dark:text-stone-300 text-[11px]">
              {message.reply_to_msg.content}
            </p>
          </div>
        )}

        {/* Voice Note Interactive Player */}
        {isVoiceNote && !message.deleted && (
          <div className="flex items-center gap-3 py-1 min-w-[200px]">
            <audio ref={audioRef} src={message.content} preload="auto" />
            <button
              onClick={togglePlayAudio}
              className="w-9 h-9 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>

            <div className="flex-1 flex flex-col gap-1">
              {/* Waveform Visualization Bars */}
              <div className="flex items-center gap-0.5 h-4 cursor-pointer">
                {[40, 70, 30, 90, 60, 80, 40, 60, 90, 50, 30, 70, 40, 60, 80, 40].map((h, i) => {
                  const barProgress = (i / 16) * (duration || 1);
                  const isPassed = currentTime >= barProgress;
                  return (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-150 ${
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
          </div>
        )}

        {/* Document Preview */}
        {message.message_type === 'document' && !message.deleted && (
          <div className="flex items-center gap-3 p-2 bg-white/70 dark:bg-stone-800/60 rounded-2xl mb-1 border border-stone-200/60 dark:border-stone-700/40">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-[#C95565] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-stone-900 dark:text-stone-100">Document.pdf</p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">PDF Document</p>
            </div>
          </div>
        )}

        {/* Image Preview */}
        {message.message_type === 'image' && !message.deleted && (
          <div className="mb-2 rounded-2xl overflow-hidden shadow-soft max-w-xs">
            <img
              src={message.content}
              alt="Photo preview"
              className="w-full h-44 object-cover"
            />
          </div>
        )}

        {/* Text Content - Render ONLY if NOT a voice note or image */}
        {!isVoiceNote && message.message_type !== 'image' && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}

        {/* Timestamp & Status Footer */}
        <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMine ? 'text-[#7D303C] dark:text-rose-200/70' : 'text-stone-400 dark:text-stone-400'}`}>
          {message.edited && <span>(edited)</span>}
          <span>{formatMessageTime(message.created_at)}</span>
          {renderStatus()}
        </div>
      </div>

      {/* Reactions Pill Badge */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          onClick={() => onReactionClick && onReactionClick(message)}
          className="flex items-center gap-1 -mt-2.5 px-2 py-0.5 bg-white dark:bg-[#1E1D24] rounded-full shadow-soft border border-stone-200 dark:border-stone-700 text-xs cursor-pointer active-scale z-10"
        >
          {message.reactions.map((r) => (
            <span key={r.id}>{r.emoji}</span>
          ))}
          {message.reactions.length > 1 && (
            <span className="text-[10px] font-bold text-stone-500">{message.reactions.length}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
