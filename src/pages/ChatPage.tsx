import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreVertical,
  Smile,
  X,
  ChevronDown,
  Search,
  CornerDownLeft,
  Mic,
  FileText,
  Image as ImageIcon,
  Video,
  Trash2,
  Pause,
  Camera,
  Paperclip,
  Phone,
  ArrowLeft,
  Check,
  Lock,
  Pin,
  SendHorizontal,
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

// Files are encrypted in memory on the phone, so keep them reasonably small
const MAX_ENCRYPTED_FILE_BYTES = 25 * 1024 * 1024;

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const { subtext, partnerPresence } = usePresence();
  const { messages, isLoadingMessages } = useInfiniteMessages();
  const { triggerTyping } = useTyping();
  const addToast = useUIStore((state) => state.addToast);
  const wallpaper = useSettingsStore((state) => state.wallpaper);

  const [inputContent, setInputContent] = useState('');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isReactionsModalOpen, setIsReactionsModalOpen] = useState(false);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [viewingMediaMessage, setViewingMediaMessage] = useState<Message | null>(null);

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Setup presence channel & initial message load
  // (Online status is tracked app-wide in AppLayout)
  useEffect(() => {
    if (currentUser) {
      loadInitialMessages();
      markAsRead(partnerUser.id, currentUser.id);
    }
  }, [currentUser?.id, loadInitialMessages, markAsRead, partnerUser.id]);

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
      if (file.size > MAX_ENCRYPTED_FILE_BYTES) {
        addToast(`${file.name} is too big (max 25 MB)`, 'error');
        continue;
      }
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
      if (file.size > MAX_ENCRYPTED_FILE_BYTES) {
        addToast(`${file.name} is too big (max 25 MB)`, 'error');
        continue;
      }
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

  // Grow the message box with its text (up to ~6 lines), like WhatsApp
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [inputContent]);

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

  const handleSend = async (e: React.SyntheticEvent) => {
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
    return 'wa-chat'; // botanical + default: WhatsApp-style doodles
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

  const hasText = inputContent.trim().length > 0;
  const isTyping = subtext.includes('Typing') || subtext.includes('Recording');

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 min-h-0 flex flex-col h-full overflow-hidden relative ${getWallpaperClass()}`}
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
        <div className="absolute inset-0 z-50 bg-[#C95565]/90 backdrop-blur-md flex flex-col items-center justify-center text-white border-4 border-dashed border-white m-4 rounded-3xl">
          <Paperclip className="w-16 h-16 mb-2" />
          <h3 className="text-xl font-bold">Drop files here to send ❤️</h3>
          <p className="text-xs opacity-80">Images, videos, & documents supported</p>
        </div>
      )}

      {/* Header */}
      <header className="wa-header sticky top-0 z-30 pl-1 pr-1.5 sm:pl-3 py-2 flex items-center justify-between flex-shrink-0 shadow-[0_1px_0_rgba(11,20,26,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center min-w-0 flex-1">
          <button
            onClick={() => navigate('/us')}
            aria-label="Back"
            className="lg:hidden p-1.5 rounded-full text-[#54656f] dark:text-[#aebac1] active:bg-black/5"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div
            onClick={() => navigate('/chat/info')}
            className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1 py-0.5 pr-2"
          >
            <Avatar src={partnerUser.avatar_url} name={partnerDisplayName} size="md" />
            <div className="min-w-0">
              <h2 className="text-[16px] font-medium text-[#111b21] dark:text-[#e9edef] leading-tight flex items-center gap-1 truncate">
                {partnerDisplayName}
                {partnerUser.mood && <span title="Mood" className="text-sm leading-none">{partnerUser.mood}</span>}
              </h2>
              <p
                className={`text-[13px] leading-tight truncate ${
                  isTyping ? 'text-[#E05A74]' : 'text-[#667781] dark:text-[#8696a0]'
                }`}
              >
                {isTyping ? subtext.toLowerCase().replace('...', '…') : partnerPresence.online ? 'online' : subtext}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center text-[#54656f] dark:text-[#aebac1] flex-shrink-0">
          <button
            onClick={() => {
              if (currentUser && partnerUser) {
                useCallStore.getState().startCall(currentUser.id, partnerUser.id, 'video');
              }
            }}
            className="p-2.5 rounded-full active:bg-black/5 dark:active:bg-white/5"
            title="Video call"
            aria-label="Video call"
          >
            <Video className="w-[22px] h-[22px]" />
          </button>
          <button
            onClick={() => {
              if (currentUser && partnerUser) {
                useCallStore.getState().startCall(currentUser.id, partnerUser.id, 'audio');
              }
            }}
            className="p-2.5 rounded-full active:bg-black/5 dark:active:bg-white/5"
            title="Voice call"
            aria-label="Voice call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/search')}
            className="hidden sm:block p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            title="Search messages"
            aria-label="Search messages"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/chat/info')}
            className="p-2 rounded-full active:bg-black/5 dark:active:bg-white/5"
            title="Chat info"
            aria-label="Chat info"
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
          className="wa-header px-4 py-2 border-t border-black/5 dark:border-white/5 flex items-center gap-3 z-20 flex-shrink-0 cursor-pointer"
        >
          <span className="w-0.5 self-stretch rounded-full bg-[#E05A74]" />
          <div className="text-[13px] truncate flex-1 min-w-0">
            <p className="text-[#E05A74] text-xs font-medium">Pinned message{pinnedMessages.length > 1 ? ` ${activePinnedIndex + 1}/${pinnedMessages.length}` : ''}</p>
            <p className="text-[#667781] dark:text-[#8696a0] truncate">
              {pinnedMessages[activePinnedIndex % pinnedMessages.length].content}
            </p>
          </div>
          <Pin className="w-4 h-4 text-[#8696a0] flex-shrink-0" />
        </div>
      )}

      {/* Messages Stream Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1.5 sm:px-[6%] pt-2 pb-3 relative"
      >
        {isLoadingMessages && messages.length === 0 && (
          <div className="flex justify-center py-4"><span className="wa-pill">Loading messages…</span></div>
        )}

        {/* WhatsApp-style encryption notice at the top of the chat */}
        {!isLoadingMessages && (
          <div className="flex justify-center mt-2 mb-3 px-6">
            <p className="wa-pill !bg-[#ffeecd] dark:!bg-[#182229] !text-[#54656f] dark:!text-[#ffd279] text-center !text-[12px] leading-snug max-w-sm flex items-start gap-1.5">
              <Lock className="w-3 h-3 mt-[3px] flex-shrink-0" />
              <span>Messages and calls are end-to-end encrypted. Only you two can read them.</span>
            </p>
          </div>
        )}

        {!isLoadingMessages && messages.length === 0 && (
          <div className="flex flex-col items-center text-center px-6 mt-10">
            <p className="text-[#54656f] dark:text-[#8696a0] text-sm mb-3">Say hi to {partnerDisplayName} 👋</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Good morning ☀️', 'I miss you 🥺', 'Love you 💗'].map((t) => (
                <button key={t} type="button" onClick={() => setInputContent(t)} className="wa-pill !text-[14px] !text-[#111b21] dark:!text-[#e9edef] active:scale-95 transition-transform">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const nextMsg = messages[idx + 1];
          const showDateSeparator =
            !prevMsg ||
            new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
          // Consecutive messages from the same person within 5 minutes form a group
          const sameRun = (a?: Message, b?: Message) =>
            Boolean(a && b && a.sender_id === b.sender_id && a.message_type !== 'system' && b.message_type !== 'system' &&
              Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 5 * 60_000 &&
              new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString());
          const isFirstInGroup = showDateSeparator || !sameRun(prevMsg, msg);
          const isLastInGroup = !sameRun(msg, nextMsg);

          return (
            <React.Fragment key={msg.local_uuid || msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center mt-3 mb-1.5 sticky top-1.5 z-10">
                  <span className="wa-pill uppercase !text-[12px]">
                    {formatDateSeparator(msg.created_at)}
                  </span>
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
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
              />
            </React.Fragment>
          );
        })}

        {/* Partner typing bubble */}
        <AnimatePresence>
          {partnerPresence.typing && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="wa-bubble wa-in wa-tail mt-2.5 ml-2 mr-auto w-fit !px-4 !py-3 flex gap-1"
              aria-label={`${partnerDisplayName} is typing`}
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="typing-dot w-2 h-2 rounded-full bg-[#8696a0]" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Floating Button */}
      {showScrollBottomBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-3 z-30 w-10 h-10 rounded-full bg-white dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] shadow-[0_1px_3px_rgba(11,20,26,0.3)] flex items-center justify-center active:scale-90 transition-transform"
          title="Scroll to latest message"
          aria-label="Scroll to latest message"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      )}

      {/* Composer */}
      <footer className="z-30 w-full px-1.5 sm:px-4 pt-1 pb-[max(env(safe-area-inset-bottom),6px)] flex-shrink-0">
        <div className="relative flex items-end gap-1.5 max-w-4xl mx-auto">
          {/* Attach sheet: WhatsApp-style colourful circles */}
          <AnimatePresence>
            {isAttachMenuOpen && !isRecordingVoice && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="absolute bottom-full left-0 right-14 mb-2 rounded-2xl bg-white dark:bg-[#233138] shadow-[0_2px_12px_rgba(11,20,26,0.18)] p-5 grid grid-cols-3 gap-y-4 z-40"
              >
                {[
                  { label: 'Document', icon: FileText, color: 'bg-[#7f66ff]', onClick: () => documentInputRef.current?.click() },
                  { label: 'Camera', icon: Camera, color: 'bg-[#ff2e74]', onClick: () => cameraInputRef.current?.click() },
                  { label: 'Gallery', icon: ImageIcon, color: 'bg-[#c861f9]', onClick: () => galleryInputRef.current?.click() },
                ].map(({ label, icon: Icon, color, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      onClick();
                    }}
                    className="flex flex-col items-center gap-1.5 text-[13px] text-[#54656f] dark:text-[#d1d7db]"
                  >
                    <span className={`w-[52px] h-[52px] rounded-full ${color} text-white flex items-center justify-center active:scale-90 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </span>
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="wa-input flex-1 min-w-0 rounded-[24px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] overflow-hidden">
            {/* Reply / edit preview inside the box, like WhatsApp */}
            {(activeReplyTarget || editingMessage) && !isRecordingVoice && (
              <div className="m-1.5 mb-0 rounded-[10px] bg-black/[0.05] dark:bg-black/20 border-l-4 border-[#E05A74] pl-2.5 pr-1 py-1.5 flex items-start gap-2">
                <div className="flex-1 min-w-0 text-[13px]">
                  <p className="font-medium text-[#E05A74] flex items-center gap-1">
                    {editingMessage ? (
                      'Edit message'
                    ) : (
                      <>
                        {getReplyIcon(activeReplyTarget!.message_type)}
                        {activeReplyTarget!.sender_id === currentUser?.id ? 'You' : partnerDisplayName}
                      </>
                    )}
                  </p>
                  <p className="text-[#667781] dark:text-[#8696a0] truncate">
                    {editingMessage
                      ? editingMessage.content
                      : activeReplyTarget!.deleted
                      ? 'This message was deleted.'
                      : activeReplyTarget!.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveReplyTarget(null);
                    if (editingMessage) {
                      setEditingMessage(null);
                      setInputContent('');
                    }
                  }}
                  className="p-1 rounded-full text-[#8696a0] hover:bg-black/5"
                  title="Cancel (Esc)"
                  aria-label="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {isRecordingVoice ? (
              /* Live voice note recording */
              <div className="flex items-center gap-2 h-12 pl-2 pr-3">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="p-2 rounded-full text-[#8696a0] hover:text-rose-500"
                  title="Discard recording"
                  aria-label="Discard recording"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <span className={`w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 ${isRecordingPaused ? '' : 'animate-pulse'}`} />
                <span className="text-[15px] tabular-nums text-[#54656f] dark:text-[#d1d7db] w-11">{formatTimer(recordingSeconds)}</span>
                <div className="flex items-center gap-[3px] h-5 flex-1 justify-center overflow-hidden">
                  {[30, 60, 40, 90, 70, 50, 80, 40, 60, 100, 50, 30, 70, 45, 85, 55].map((h, i) => {
                    const dynamicH = Math.min(100, Math.max(15, h * (audioLevel / 40)));
                    return (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-[#8696a0] transition-all duration-75"
                        style={{ height: isRecordingPaused ? '20%' : `${dynamicH}%` }}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={isRecordingPaused ? resumeRecording : pauseRecording}
                  className="p-1.5 rounded-full text-[#ff3b30]"
                  title={isRecordingPaused ? 'Resume recording' : 'Pause recording'}
                  aria-label={isRecordingPaused ? 'Resume recording' : 'Pause recording'}
                >
                  {isRecordingPaused ? <Mic className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMessage(null);
                    setIsEmojiPickerOpen((prev) => !prev);
                  }}
                  className="p-3 text-[#8696a0] hover:text-[#54656f] flex-shrink-0"
                  title="Emoji"
                  aria-label="Emoji"
                >
                  <Smile className="w-6 h-6" />
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputContent}
                  onChange={(e) => {
                    setInputContent(e.target.value);
                    triggerTyping();
                  }}
                  onFocus={() => setIsAttachMenuOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setActiveReplyTarget(null);
                      setEditingMessage(null);
                    }
                    // Computers: Enter sends, Shift+Enter is a new line. Phones: Enter is a new line.
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
                      e.preventDefault();
                      void handleSend(e);
                    }
                  }}
                  placeholder="Message"
                  className="flex-1 min-w-0 bg-transparent resize-none text-[16px] leading-[22px] py-[13px] max-h-[142px] focus:outline-none placeholder:text-[#8696a0] text-[#111b21] dark:text-[#e9edef]"
                />
                <button
                  type="button"
                  onClick={() => setIsAttachMenuOpen((open) => !open)}
                  className={`p-3 pr-2 flex-shrink-0 transition-colors ${isAttachMenuOpen ? 'text-[#E05A74]' : 'text-[#8696a0] hover:text-[#54656f]'}`}
                  title="Attach"
                  aria-label="Attach"
                  aria-expanded={isAttachMenuOpen}
                >
                  <Paperclip className="w-[22px] h-[22px] -rotate-45" />
                </button>
                {!hasText && !editingMessage && (
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-3 pl-2 text-[#8696a0] hover:text-[#54656f] flex-shrink-0"
                    title="Camera"
                    aria-label="Camera"
                  >
                    <Camera className="w-[22px] h-[22px]" />
                  </button>
                )}
              </form>
            )}
          </div>

          {/* One round button: mic when empty, send while typing or recording */}
          <motion.button
            type="button"
            onClick={(e) => {
              if (isRecordingVoice) void stopAndSendVoiceNote();
              else if (hasText) void handleSend(e);
              else void startRecording();
            }}
            // keep the keyboard open after sending, like WhatsApp
            onMouseDown={(e) => hasText && e.preventDefault()}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full bg-[#E05A74] hover:bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-[0_1px_3px_rgba(11,20,26,0.25)]"
            title={isRecordingVoice ? 'Send voice note' : hasText ? 'Send' : 'Record voice note'}
            aria-label={isRecordingVoice ? 'Send voice note' : hasText ? 'Send' : 'Record voice note'}
          >
            {isRecordingVoice || hasText ? (
              editingMessage ? <Check className="w-6 h-6" /> : <SendHorizontal className="w-[22px] h-[22px] ml-0.5" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </motion.button>
        </div>
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
