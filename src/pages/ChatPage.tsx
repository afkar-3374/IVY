import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreVertical,
  Smile,
  Send,
  X,
  ChevronLeft,
  ChevronDown,
  Search,
  CornerDownLeft,
  Mic,
  FileText,
  Image as ImageIcon,
  Video,
  Trash2,
  Pause,
  Play,
  Camera,
  Plus,
  Paperclip,
  Phone,
  GalleryHorizontal,
  FolderOpen,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useCallStore } from '../store/useCallStore';
import { usePresence } from '../hooks/usePresence';
import { useInfiniteMessages } from '../hooks/useInfiniteMessages';
import { useTyping } from '../hooks/useTyping';
import { voiceRecorder } from '../services/voiceRecorder';
import { storageService } from '../services/storageService';
import { MessageBubble } from '../components/Chat/MessageBubble';
import { MessageActionModal } from '../components/Chat/MessageActionModal';
import { EmojiPickerModal } from '../components/Chat/EmojiPickerModal';
import { ReactionsDetailModal } from '../components/Chat/ReactionsDetailModal';
import { MediaViewerModal } from '../components/Chat/MediaViewerModal';
import { ForwardMessageModal } from '../components/Chat/ForwardMessageModal';
import { Avatar } from '../components/ui/Avatar';
import { formatDateSeparator } from '../utils/date';
import type { Message } from '../types';
import { useUIStore } from '../store/useUIStore';
import { useSettingsStore } from '../store/useSettingsStore';

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const { subtext, partnerPresence, initPresenceChannel } = usePresence();
  const { messages, isLoadingMessages } = useInfiniteMessages();
  const { triggerTyping } = useTyping();
  const addToast = useUIStore((state) => state.addToast);
  const wallpaper = useSettingsStore((state) => state.wallpaper);

  const [inputContent, setInputContent] = useState('');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isReactionsModalOpen, setIsReactionsModalOpen] = useState(false);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [viewingMediaMessage, setViewingMediaMessage] = useState<Message | null>(null);
  const [isAttachTrayOpen, setIsAttachTrayOpen] = useState(false);

  // Voice Note Recording States
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Hidden File Inputs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const {
    sendMessage,
    retryFailedMessage,
    editMessage,
    deleteMessage,
    togglePin,
    toggleStar,
    toggleReaction,
    markAsRead,
    loadInitialMessages,
    activeReplyTarget,
    selectedMessage,
    editingMessage,
    targetMessageId,
    setActiveReplyTarget,
    setSelectedMessage,
    setEditingMessage,
    setTargetMessageId,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Setup presence channel & initial message load
  useEffect(() => {
    if (currentUser) {
      const cleanupPresence = initPresenceChannel(currentUser.id);
      loadInitialMessages();
      markAsRead(partnerUser.id, currentUser.id);

      return () => {
        cleanupPresence();
      };
    }
  }, [currentUser?.id, initPresenceChannel, loadInitialMessages, markAsRead, partnerUser.id]);

  // Mark unread messages as read when new messages arrive
  useEffect(() => {
    if (currentUser) {
      markAsRead(partnerUser.id, currentUser.id);
    }
  }, [messages.length, currentUser, partnerUser.id, markAsRead]);

  // Desktop Clipboard Paste Listener for Images/Videos/Files (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      const videoFiles: File[] = [];
      const docFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        } else if (items[i].type.indexOf('video') !== -1) {
          const file = items[i].getAsFile();
          if (file) videoFiles.push(file);
        } else {
          const file = items[i].getAsFile();
          if (file) docFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleProcessAndSendImages(imageFiles);
      } else if (videoFiles.length > 0) {
        e.preventDefault();
        handleProcessAndSendVideos(videoFiles);
      } else if (docFiles.length > 0) {
        e.preventDefault();
        handleProcessAndSendDocuments(docFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentUser, partnerUser.id]);

  // Handle image files batch upload
  const handleProcessAndSendImages = async (files: File[]) => {
    if (!currentUser || files.length === 0) return;

    addToast(`Compressing & sending ${files.length} image(s)...`, 'info');

    for (const file of files) {
      try {
        const { dataUrl, fileUrl } = await storageService.processAndUploadImage(file);
        await sendMessage(currentUser.id, partnerUser.id, fileUrl || dataUrl, 'image');
      } catch (err) {
        addToast('Failed to process image', 'error');
      }
    }
  };

  // Handle video files batch upload
  const handleProcessAndSendVideos = async (files: File[]) => {
    if (!currentUser || files.length === 0) return;

    addToast(`Processing & sending ${files.length} video(s)...`, 'info');

    for (const file of files) {
      try {
        const { dataUrl, fileUrl } = await storageService.processAndUploadVideo(file);
        await sendMessage(currentUser.id, partnerUser.id, fileUrl || dataUrl, 'video');
      } catch (err) {
        addToast('Failed to process video', 'error');
      }
    }
  };

  // Handle document files batch upload
  const handleProcessAndSendDocuments = async (files: File[]) => {
    if (!currentUser || files.length === 0) return;

    addToast(`Preparing & sending ${files.length} file(s)...`, 'info');

    for (const file of files) {
      try {
        const { dataUrl, fileUrl } = await storageService.processAndUploadDocument(file);
        await sendMessage(currentUser.id, partnerUser.id, fileUrl || dataUrl, 'document');
      } catch (err) {
        addToast('Failed to process file', 'error');
      }
    }
  };

  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      const videoFiles = files.filter((f) => f.type.startsWith('video/'));

      if (imageFiles.length > 0) handleProcessAndSendImages(imageFiles);
      if (videoFiles.length > 0) handleProcessAndSendVideos(videoFiles);

      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleCameraFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) handleProcessAndSendVideos([file]);
      else handleProcessAndSendImages([file]);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleDocumentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      handleProcessAndSendDocuments(files);
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  // Drag & Drop Handlers for Desktop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const droppedFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    const imageFiles = droppedFiles.filter((f) => f.type.startsWith('image/'));
    const videoFiles = droppedFiles.filter((f) => f.type.startsWith('video/'));
    const docFiles = droppedFiles.filter(
      (f) => !f.type.startsWith('image/') && !f.type.startsWith('video/')
    );

    if (imageFiles.length > 0) handleProcessAndSendImages(imageFiles);
    if (videoFiles.length > 0) handleProcessAndSendVideos(videoFiles);
    if (docFiles.length > 0) handleProcessAndSendDocuments(docFiles);
  };

  // Handle jump to message & target highlight
  const jumpToOriginalMessage = (localUuid: string) => {
    const el = document.getElementById(`msg-${localUuid}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#C95565]', 'ring-offset-2', 'rounded-3xl', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#C95565]', 'ring-offset-2', 'rounded-3xl', 'transition-all');
      }, 2000);
    } else {
      setTargetMessageId(localUuid);
    }
  };

  // Auto-scroll on initial load or target message jump
  useEffect(() => {
    if (targetMessageId) {
      jumpToOriginalMessage(targetMessageId);
      setTargetMessageId(null);
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, targetMessageId]);

  // Focus input on active reply target selection
  useEffect(() => {
    if (activeReplyTarget && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeReplyTarget]);

  // Track scroll position for scroll-to-bottom button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBottomBtn(isUp);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !currentUser) return;

    if (editingMessage) {
      await editMessage(editingMessage.local_uuid, inputContent.trim());
      setInputContent('');
      return;
    }

    const text = inputContent.trim();
    setInputContent('');
    await sendMessage(currentUser.id, partnerUser.id, text, 'text');
  };

  // Start Voice Note Recording
  const startRecording = async () => {
    try {
      await voiceRecorder.start();
      setIsRecordingVoice(true);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      const updateAudioLevel = () => {
        setAudioLevel(voiceRecorder.getAudioLevel());
        animFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      animFrameRef.current = requestAnimationFrame(updateAudioLevel);
    } catch (err: any) {
      addToast(err.message || 'Microphone access is required to record voice notes.', 'error');
    }
  };

  // Pause Voice Note Recording
  const pauseRecording = () => {
    voiceRecorder.pause();
    setIsRecordingPaused(true);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  // Resume Voice Note Recording
  const resumeRecording = () => {
    voiceRecorder.resume();
    setIsRecordingPaused(false);
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    const updateAudioLevel = () => {
      setAudioLevel(voiceRecorder.getAudioLevel());
      animFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };
    animFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  // Cancel Voice Note Recording
  const cancelRecording = () => {
    voiceRecorder.cancel();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsRecordingVoice(false);
    setIsRecordingPaused(false);
    setRecordingSeconds(0);
    setAudioLevel(0);
    addToast('Voice recording cancelled', 'info');
  };

  // Stop & Send Voice Note
  const stopAndSendVoiceNote = async () => {
    if (!currentUser) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    try {
      const { audioUrl } = await voiceRecorder.stop();
      setIsRecordingVoice(false);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);
      setAudioLevel(0);

      await sendMessage(currentUser.id, partnerUser.id, audioUrl, 'voice');
      addToast('Voice note sent ❤️', 'success');
    } catch (err: any) {
      addToast('Failed to send voice note', 'error');
      setIsRecordingVoice(false);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);
      setAudioLevel(0);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMessageLongPress = (msg: Message) => {
    setSelectedMessage(msg);
    setIsActionModalOpen(true);
  };

  const handleReactionClick = (msg: Message) => {
    setSelectedMessage(msg);
    setIsReactionsModalOpen(true);
  };

  const handleMediaClick = (msg: Message) => {
    setViewingMediaMessage(msg);
    setIsMediaViewerOpen(true);
  };

  const pinnedMessages = messages.filter((m) => m.pinned);
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);

  const partnerDisplayName = currentUser?.nickname || partnerUser.display_name;

  const customWallpaperUrl = useSettingsStore((state) => state.customWallpaperUrl);

  const getWallpaperClass = () => {
    if (wallpaper === 'custom') return 'bg-stone-100 dark:bg-[#16151A]';
    if (wallpaper === 'sunset') return 'bg-gradient-to-b from-amber-50 via-rose-50 to-pink-100 dark:from-[#1E1B24] dark:to-[#2B1B26]';
    if (wallpaper === 'starry') return 'bg-slate-900 text-[#FDF8F6]';
    if (wallpaper === 'blush') return 'bg-gradient-to-br from-pink-50 via-rose-50 to-red-50 dark:from-[#2A1520] dark:to-[#1A1020]';
    if (wallpaper === 'aurora') return 'bg-gradient-to-br from-violet-900 via-purple-800 to-blue-900 text-white';
    if (wallpaper === 'minimal') return 'bg-[#FDF8F6] dark:bg-[#16151A]';
    return 'bg-[#FDF8F6] dark:bg-[#16151A]'; // botanical + default
  };

  const customWallpaperStyle =
    wallpaper === 'custom' && customWallpaperUrl
      ? { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : undefined;

  const getReplyIcon = (type?: string) => {
    if (type === 'voice') return <Mic className="w-3.5 h-3.5 text-[#C95565]" />;
    if (type === 'image') return <ImageIcon className="w-3.5 h-3.5 text-[#C95565]" />;
    if (type === 'video') return <Video className="w-3.5 h-3.5 text-[#C95565]" />;
    if (type === 'document' || type === 'file') return <FileText className="w-3.5 h-3.5 text-[#C95565]" />;
    return <CornerDownLeft className="w-3.5 h-3.5 text-[#C95565]" />;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => isAttachTrayOpen && setIsAttachTrayOpen(false)}
      className={`flex-1 flex flex-col overflow-hidden relative ${getWallpaperClass()}`}
      style={customWallpaperStyle}
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleGalleryFileSelect}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraFileSelect}
      />
      <input
        type="file"
        ref={documentInputRef}
        accept="*/*"
        multiple
        className="hidden"
        onChange={handleDocumentFileSelect}
      />

      {/* Desktop Drag & Drop Visual Dropzone Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#C95565]/90 backdrop-blur-md flex flex-col items-center justify-center text-white border-4 border-dashed border-white m-4 rounded-3xl animate-pulse">
          <Paperclip className="w-16 h-16 mb-2" />
          <h3 className="text-xl font-bold">Drop files here to send ❤️</h3>
          <p className="text-xs opacity-80">Images, videos, & documents supported</p>
        </div>
      )}

      {/* Header — fixed, never scrolls */}
      <header className="flex-shrink-0 z-30 bg-white/95 dark:bg-[#1E1D24]/95 backdrop-blur-md px-4 py-3 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="p-1 rounded-full text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div
            onClick={() => navigate('/chat/info')}
            className="flex items-center gap-2.5 cursor-pointer active-scale"
          >
            <Avatar
              src={partnerUser.avatar_url}
              name={partnerDisplayName}
              size="md"
              isOnline={partnerPresence.online}
            />
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 leading-tight">
                {partnerDisplayName}
              </h2>
              <p
                className={`text-[11px] font-semibold ${
                  subtext.includes('Typing') || isRecordingVoice
                    ? 'text-[#C95565] animate-pulse font-bold'
                    : 'text-stone-400 dark:text-stone-400'
                }`}
              >
                {isRecordingVoice ? 'Recording Voice...' : subtext}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 text-stone-600 dark:text-stone-300">
          <button
            onClick={() => {
              if (currentUser && partnerUser) {
                useCallStore.getState().startCall(currentUser.id, partnerUser.id, 'audio');
              }
            }}
            className="p-2 rounded-full text-[#C95565] hover:bg-[#C95565]/10 active-scale"
            title="Start Voice Call"
            aria-label="Start Voice Call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (currentUser && partnerUser) {
                useCallStore.getState().startCall(currentUser.id, partnerUser.id, 'video');
              }
            }}
            className="p-2 rounded-full text-[#C95565] hover:bg-[#C95565]/10 active-scale"
            title="Start Video Call"
            aria-label="Start Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/search')}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 active-scale"
            title="Search Messages"
            aria-label="Search Messages"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/chat/info')}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 active-scale"
            title="Chat Info"
            aria-label="Chat Info"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div
          onClick={() => {
            const nextIdx = (activePinnedIndex + 1) % pinnedMessages.length;
            setActivePinnedIndex(nextIdx);
            const target = pinnedMessages[nextIdx];
            jumpToOriginalMessage(target.local_uuid);
          }}
          className="bg-white/90 dark:bg-[#18171F]/90 px-4 py-2 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between z-20 flex-shrink-0 cursor-pointer active-scale backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-xs text-[#C95565]">📌</span>
            <div className="text-xs truncate">
              <span className="font-bold text-stone-900 dark:text-stone-100 mr-1">Pinned:</span>
              <span className="text-stone-600 dark:text-stone-300 italic">
                {pinnedMessages[activePinnedIndex % pinnedMessages.length].content}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-stone-400 ml-2">
            {activePinnedIndex + 1}/{pinnedMessages.length}
          </span>
        </div>
      )}

      {/* Messages Stream — only this scrolls */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 relative"
        style={{ overscrollBehavior: 'contain' }}
      >
        {isLoadingMessages && messages.length === 0 && (
          <div className="flex flex-col gap-2.5 px-2 py-3">
            {[80, 60, 72, 55, 90].map((w, i) => (
              <div key={i} className={`skeleton h-9 rounded-3xl ${i % 2 === 0 ? 'ml-auto' : 'mr-auto'}`} style={{ width: `${w}%`, maxWidth: 260 }} />
            ))}
          </div>
        )}

        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const nextMsg = messages[idx + 1];

          const showDateSeparator =
            !prevMsg ||
            new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

          // Consecutive grouping: same sender, within 2 minutes
          const CONSEC_MS = 120_000;
          const isConsecutive =
            !showDateSeparator &&
            msg.message_type !== 'system' &&
            prevMsg?.message_type !== 'system' &&
            prevMsg?.sender_id === msg.sender_id &&
            Math.abs(new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < CONSEC_MS;

          const isLastInGroup =
            !nextMsg ||
            nextMsg.message_type === 'system' ||
            msg.message_type === 'system' ||
            nextMsg.sender_id !== msg.sender_id ||
            new Date(nextMsg.created_at).toDateString() !== new Date(msg.created_at).toDateString() ||
            Math.abs(new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime()) >= CONSEC_MS;

          return (
            <React.Fragment key={msg.local_uuid || msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="px-4 py-1 rounded-full bg-white/70 dark:bg-stone-800/70 text-[11px] font-bold text-stone-500 dark:text-stone-400 shadow-soft backdrop-blur-md border border-stone-200/50 dark:border-stone-700/40 select-none">
                    {formatDateSeparator(msg.created_at)}
                  </div>
                </div>
              )}

              <MessageBubble
                message={msg}
                onLongPress={handleMessageLongPress}
                onReactionClick={handleReactionClick}
                onMediaClick={handleMediaClick}
                onSwipeToReply={(m) => setActiveReplyTarget(m)}
                onRetry={(m) => retryFailedMessage(m.local_uuid)}
                onJumpToOriginal={jumpToOriginalMessage}
                isConsecutive={isConsecutive}
                isLastInGroup={isLastInGroup}
              />
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Scroll to Bottom Floating Button */}
      {showScrollBottomBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-5 z-30 p-2.5 rounded-full bg-white dark:bg-[#1E1D24] text-[#C95565] shadow-lg border border-stone-100 dark:border-stone-800 active-scale hover:scale-105 transition-all"
          title="Scroll to latest message"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Reply Composer Banner */}
      <AnimatePresence>
        {activeReplyTarget && !isRecordingVoice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0 bg-white/95 dark:bg-[#1E1D24]/95 px-4 py-2 border-t border-stone-100 dark:border-stone-800/60 flex items-center gap-3 z-20"
          >
            <div className="w-0.5 self-stretch bg-[#C95565] rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#C95565] mb-0.5">
                {activeReplyTarget.sender_id === currentUser?.id ? 'You' : partnerDisplayName}
              </p>
              <p className="text-[12px] text-stone-500 dark:text-stone-400 truncate">
                {activeReplyTarget.deleted ? 'Deleted message' : activeReplyTarget.content}
              </p>
            </div>
            <button
              onClick={() => setActiveReplyTarget(null)}
              className="p-1.5 rounded-full text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 active-scale flex-shrink-0"
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Input / Voice Note Recorder Footer — fixed, never scrolls */}
      <footer className="flex-shrink-0 z-30 w-full bg-white/95 dark:bg-[#1E1D24]/95 backdrop-blur-md border-t border-stone-100/80 dark:border-stone-800/60 pb-safe">
        {isRecordingVoice ? (
          /* Voice Recording Bar */
          <div className="flex items-center gap-3 px-3 py-2.5 max-w-2xl mx-auto">
            <button type="button" onClick={cancelRecording}
              className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/40 text-[#C95565] flex items-center justify-center flex-shrink-0 active-scale"
              title="Discard">
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center gap-2.5 bg-stone-100 dark:bg-stone-800/70 py-2 px-3 rounded-2xl">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex-shrink-0" />
              <span className="text-xs font-bold text-red-500 font-mono tabular-nums min-w-[36px]">{formatTimer(recordingSeconds)}</span>
              <div className="flex items-end gap-0.5 h-5 flex-1 justify-center overflow-hidden">
                {[30, 60, 40, 90, 70, 50, 80, 40, 60, 100, 50, 30, 70, 45].map((h, i) => {
                  const dh = Math.min(100, Math.max(15, h * (audioLevel / 38)));
                  return <div key={i} className="w-0.5 rounded-full bg-[#C95565] transition-all duration-75" style={{ height: isRecordingPaused ? '25%' : `${dh}%` }} />;
                })}
              </div>
              <button type="button" onClick={isRecordingPaused ? resumeRecording : pauseRecording}
                className="p-1 rounded-full text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 active-scale" title={isRecordingPaused ? 'Resume' : 'Pause'}>
                {isRecordingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button type="button" onClick={stopAndSendVoiceNote}
              className="w-10 h-10 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale hover:bg-[#B34757]">
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        ) : (
          /* Standard Input Bar */
          <div className="px-3 py-2 max-w-2xl mx-auto">
            {/* Attachment Tray — slides in above input */}
            <AnimatePresence>
              {isAttachTrayOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: [0.34, 1.2, 0.64, 1] }}
                  className="flex items-center gap-3 mb-2.5 px-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { label: 'Gallery', icon: <GalleryHorizontal className="w-5 h-5" />, color: 'bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300', action: () => { galleryInputRef.current?.click(); setIsAttachTrayOpen(false); } },
                    { label: 'Camera', icon: <Camera className="w-5 h-5" />, color: 'bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-300', action: () => { cameraInputRef.current?.click(); setIsAttachTrayOpen(false); } },
                    { label: 'File', icon: <FolderOpen className="w-5 h-5" />, color: 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300', action: () => { documentInputRef.current?.click(); setIsAttachTrayOpen(false); } },
                  ].map((item, i) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      type="button"
                      onClick={item.action}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ${item.color} active-scale flex-1`}
                    >
                      {item.icon}
                      <span className="text-[10px] font-bold">{item.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSend} className="flex items-center gap-2">
              {/* Attach toggle */}
              <motion.button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsAttachTrayOpen(p => !p); }}
                animate={{ rotate: isAttachTrayOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active-scale transition-colors ${
                  isAttachTrayOpen
                    ? 'bg-[#C95565] text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-[#C95565]'
                }`}
                title="Attach"
              >
                <Plus className="w-5 h-5" />
              </motion.button>

              {/* Text input */}
              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputContent}
                  onChange={(e) => { setInputContent(e.target.value); triggerTyping(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setActiveReplyTarget(null); setEditingMessage(null); }
                  }}
                  placeholder={editingMessage ? 'Edit message…' : activeReplyTarget ? 'Type your reply…' : 'Message…'}
                  className="w-full bg-stone-100 dark:bg-[#1A1920] text-stone-900 dark:text-stone-100 text-sm px-4 py-2.5 rounded-2xl border border-transparent focus:outline-none focus:border-[#C95565]/30 transition-colors pr-9"
                />
                <button
                  type="button"
                  onClick={() => { setSelectedMessage(null); setIsEmojiPickerOpen(p => !p); }}
                  className="absolute right-2.5 text-stone-400 hover:text-[#C95565] transition-colors"
                  title="Emoji"
                >
                  <Smile className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </button>
              </div>

              {/* Send / Mic */}
              <AnimatePresence mode="wait">
                {inputContent.trim() ? (
                  <motion.button
                    key="send"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    type="submit"
                    className="w-10 h-10 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale hover:bg-[#B34757]"
                    title="Send"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="mic"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    type="button"
                    onClick={startRecording}
                    className="w-10 h-10 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale hover:bg-[#B34757]"
                    title="Voice Note"
                  >
                    <Mic className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  </motion.button>
                )}
              </AnimatePresence>
            </form>
          </div>
        )}
      </footer>

      {/* Action Modals */}
      <MessageActionModal
        isOpen={isActionModalOpen}
        message={selectedMessage}
        currentUserId={currentUser?.id || ''}
        onClose={() => setIsActionModalOpen(false)}
        onReactionSelect={(emoji) => {
          if (selectedMessage && currentUser) {
            toggleReaction(selectedMessage.local_uuid, currentUser.id, emoji);
          }
        }}
        onOpenCustomEmojiPicker={() => setIsEmojiPickerOpen(true)}
        onReply={() => selectedMessage && setActiveReplyTarget(selectedMessage)}
        onEdit={() => {
          if (selectedMessage) {
            setEditingMessage(selectedMessage);
            setInputContent(selectedMessage.content);
          }
        }}
        onDelete={() => selectedMessage && deleteMessage(selectedMessage.local_uuid)}
        onCopy={() => {
          if (selectedMessage) {
            navigator.clipboard.writeText(selectedMessage.content);
            addToast('Copied to clipboard', 'info');
          }
        }}
        onForward={() => selectedMessage && setIsForwardModalOpen(true)}
        onToggleStar={() => selectedMessage && toggleStar(selectedMessage.local_uuid)}
        onTogglePin={() => selectedMessage && togglePin(selectedMessage.local_uuid)}
      />

      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelectEmoji={(emoji) => {
          if (selectedMessage && currentUser) {
            toggleReaction(selectedMessage.local_uuid, currentUser.id, emoji);
            setSelectedMessage(null);
          } else {
            setInputContent((prev) => prev + emoji);
          }
        }}
      />

      <ReactionsDetailModal
        isOpen={isReactionsModalOpen}
        message={selectedMessage}
        onClose={() => setIsReactionsModalOpen(false)}
      />

      <MediaViewerModal
        isOpen={isMediaViewerOpen}
        message={viewingMediaMessage}
        allMessages={messages}
        onClose={() => setIsMediaViewerOpen(false)}
      />

      <ForwardMessageModal
        isOpen={isForwardModalOpen}
        message={selectedMessage}
        onClose={() => setIsForwardModalOpen(false)}
        onForwardSuccess={() => addToast('Message forwarded ❤️', 'success')}
      />
    </div>
  );
};

export default ChatPage;
