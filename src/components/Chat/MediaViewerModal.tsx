import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Volume2,
  VolumeX,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  File,
  ExternalLink,
} from 'lucide-react';
import type { Message } from '../../types';
import { formatMessageTime } from '../../utils/date';
import { getFileCategory, getFileExtensionLabel, formatFileSize } from '../../utils/fileIcons';

interface MediaViewerModalProps {
  isOpen: boolean;
  message: Message | null;
  allMessages?: Message[];
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  message,
  allMessages = [],
  onClose,
}) => {
  const [currentMsg, setCurrentMsg] = useState<Message | null>(message);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Video Player States
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoSpeed, setVideoSpeed] = useState<1 | 1.5 | 2>(1);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync currentMsg when props change
  useEffect(() => {
    setCurrentMsg(message);
    setZoom(1);
    setRotation(0);
    setIsVideoPlaying(false);
  }, [message]);

  const isVideo =
    currentMsg?.message_type === 'video' ||
    (typeof currentMsg?.content === 'string' && currentMsg.content.startsWith('data:video/'));

  const isImage =
    currentMsg?.message_type === 'image' ||
    (typeof currentMsg?.content === 'string' && currentMsg.content.startsWith('data:image/'));

  const isDocument =
    currentMsg?.message_type === 'document' ||
    currentMsg?.message_type === 'file' ||
    (!isImage && !isVideo && currentMsg?.message_type !== 'voice' && currentMsg?.message_type !== 'text');

  // List of media/document messages for next/prev navigation
  const navigatableMessages = allMessages.filter((m) => !m.deleted && m.message_type !== 'system');

  const currentIndex = navigatableMessages.findIndex(
    (m) => m.local_uuid === currentMsg?.local_uuid || m.id === currentMsg?.id
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < navigatableMessages.length - 1;

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (hasPrev) {
      setCurrentMsg(navigatableMessages[currentIndex - 1]);
      setZoom(1);
      setRotation(0);
      setIsVideoPlaying(false);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (hasNext) {
      setCurrentMsg(navigatableMessages[currentIndex + 1]);
      setZoom(1);
      setRotation(0);
      setIsVideoPlaying(false);
    }
  };

  // Keyboard Navigation (Space for Play/Pause, ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === ' ' && isVideo && videoRef.current) {
        e.preventDefault();
        toggleVideoPlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, currentIndex, isVideo, isVideoPlaying]);

  if (!isOpen || !currentMsg) return null;

  const mediaUrl = currentMsg.content;

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsVideoPlaying(true))
        .catch(() => setIsVideoPlaying(false));
    }
  };

  const toggleVideoSpeed = () => {
    const nextSpeed = videoSpeed === 1 ? 1.5 : videoSpeed === 1.5 ? 2 : 1;
    setVideoSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const togglePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        // PiP not supported or failed
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = isVideo
      ? `ivy_video_${Date.now()}.mp4`
      : isImage
      ? `ivy_image_${Date.now()}.jpg`
      : `ivy_document_${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!isImage) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.2, 3));
    } else {
      setZoom((z) => Math.max(z - 0.2, 0.5));
    }
  };

  const handleDoubleClickZoom = () => {
    if (isImage) {
      setZoom((z) => (z === 1 ? 2 : 1));
    }
  };

  const getDocIcon = (category: string) => {
    if (category === 'pdf' || category === 'word') return <FileText className="w-12 h-12 text-[#C95565]" />;
    if (category === 'excel') return <FileSpreadsheet className="w-12 h-12 text-emerald-500" />;
    if (category === 'code' || category === 'text') return <FileCode className="w-12 h-12 text-amber-500" />;
    if (category === 'archive') return <FileArchive className="w-12 h-12 text-purple-500" />;
    return <File className="w-12 h-12 text-stone-400" />;
  };

  const fileCat = getFileCategory(currentMsg.content);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 select-none">
        {/* Top Controls Header Bar */}
        <div className="flex items-center justify-between z-20 text-white px-2 py-1">
          <div className="text-xs font-semibold opacity-80">
            {formatMessageTime(currentMsg.created_at)}
          </div>

          <div className="flex items-center gap-2">
            {isImage && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 active-scale"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 active-scale"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 active-scale"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-5 h-5 text-white" />
                </button>
              </>
            )}

            {isVideo && (
              <>
                <button
                  type="button"
                  onClick={toggleVideoSpeed}
                  className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs font-bold text-white active-scale"
                  title="Playback speed"
                >
                  {videoSpeed}x
                </button>

                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 active-scale"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                </button>

                <button
                  type="button"
                  onClick={togglePiP}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 active-scale"
                  title="Picture in Picture"
                >
                  <Maximize2 className="w-5 h-5 text-white" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 active-scale"
              title="Download File"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 active-scale"
              title="Close (Esc)"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Central Media/Document Viewport */}
        <div
          onWheel={handleWheelZoom}
          className="flex-1 flex items-center justify-center overflow-hidden relative my-2"
        >
          {/* Prev Arrow Button */}
          {hasPrev && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 z-30 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md active-scale"
              title="Previous Item"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {isDocument ? (
            /* Document Card Preview */
            <div className="flex flex-col items-center justify-center p-8 bg-stone-900/90 rounded-3xl border border-stone-800 text-white max-w-md w-full text-center shadow-2xl space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                {getDocIcon(fileCat)}
              </div>

              <div>
                <h3 className="text-base font-bold text-white break-all">
                  Document Attachment
                </h3>
                <p className="text-xs text-stone-400 mt-1 uppercase font-semibold">
                  {getFileExtensionLabel(mediaUrl)} File
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-5 py-2.5 rounded-full bg-[#C95565] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#B34757] active-scale shadow-soft"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </button>

                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-full bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-white/20 active-scale"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </a>
              </div>
            </div>
          ) : isVideo ? (
            <div className="relative flex items-center justify-center max-h-[82vh] max-w-full">
              <video
                ref={videoRef}
                src={mediaUrl}
                controls
                muted={isMuted}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onEnded={() => setIsVideoPlaying(false)}
                className="max-h-[82vh] max-w-full rounded-2xl shadow-2xl"
              />
            </div>
          ) : (
            <motion.div
              drag={zoom > 1}
              dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
              className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
              onDoubleClick={handleDoubleClickZoom}
            >
              <img
                src={mediaUrl}
                alt="Full-screen media view"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
                className="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
            </motion.div>
          )}

          {/* Next Arrow Button */}
          {hasNext && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 z-30 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md active-scale"
              title="Next Item"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Bottom Status Footer */}
        <div className="text-center text-xs text-stone-400 py-1 flex items-center justify-between px-4 z-20">
          <span>{isVideo ? 'Press Space to Play/Pause' : 'Use arrow keys to navigate'}</span>
          {navigatableMessages.length > 0 && (
            <span>
              {currentIndex + 1} of {navigatableMessages.length}
            </span>
          )}
        </div>
      </div>
    </AnimatePresence>
  );
};
