import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreVertical,
  Smile,
  Send,
  X,
  ChevronLeft,
  Heart,
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
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useCallStore } from '../store/useCallStore';
import { useCoupleStore } from '../store/useCoupleStore';
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
  const sendLove = useCoupleStore((state) => state.sendLove);
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
  const inputRef = useRef<HTMLInputElement>(null);

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
        <div className="absolute inset-0 z-50 bg-[#C95565]/90 backdrop-blur-md flex flex-col items-center justify-center text-white border-4 border-dashed border-white m-4 rounded-3xl animate-pulse">
          <Paperclip className="w-16 h-16 mb-2" />
          <h3 className="text-xl font-bold">Drop files here to send ❤️</h3>
          <p className="text-xs opacity-80">Images, videos, & documents supported</p>
        </div>
      )}

      {/* Header */}
      <header className="glass !rounded-none !border-x-0 !border-t-0 sticky top-0 z-30 px-3 sm:px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate('/us')}
            aria-label="Back to Us"
            className="lg:hidden p-1 rounded-full text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div
            onClick={() => navigate('/chat/info')}
            className="flex items-center gap-2.5 cursor-pointer active-scale min-w-0"
          >
            <div className="relative">
              {partnerPresence.online && <span className="online-pulse absolute inset-0 rounded-full" />}
              <Avatar src={partnerUser.avatar_url} name={partnerDisplayName} size="md" isOnline={partnerPresence.online} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 leading-tight flex items-center gap-1 truncate">
                {partnerDisplayName}
                {partnerUser.mood && <span title="Mood" className="text-base leading-none">{partnerUser.mood}</span>}
              </h2>
              <AnimatePresence mode="wait">
                <motion.p
                  key={subtext}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className={`text-[11px] font-semibold truncate flex items-center gap-1 ${
                    subtext.includes('Typing') || subtext.includes('Recording')
                      ? 'text-[#E05A74]'
                      : partnerPresence.online
                      ? 'text-emerald-600'
                      : 'text-stone-400 dark:text-stone-400'
                  }`}
                >
                  {subtext.includes('Typing') ? (
                    <>
                      typing
                      <span className="inline-flex gap-0.5 ml-0.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="typing-dot w-1 h-1 rounded-full bg-[#E05A74]" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    </>
                  ) : (
                    subtext
                  )}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 text-stone-600 dark:text-stone-300 flex-shrink-0">
          <button
            onClick={() => sendLove('tap')}
            className="p-2 rounded-full text-[#E05A74] hover:bg-[#E05A74]/10 active:scale-75 transition-transform"
            title="Send a love tap"
            aria-label="Send a love tap"
          >
            <Heart className="w-5 h-5 fill-[#E05A74]/25" />
          </button>
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
            className="hidden sm:block p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 active-scale"
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

      {/* Messages Stream Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="chat-wallpaper flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 pt-2 pb-4 relative"
      >
        {isLoadingMessages && messages.length === 0 && (
          <div className="text-center py-4 text-xs text-stone-400">Loading messages...</div>
        )}

        {!isLoadingMessages && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center px-6"
          >
            <div className="text-6xl animate-heartbeat mb-3">💌</div>
            <p className="font-serif italic text-2xl text-stone-700 dark:text-stone-200">Say something sweet</p>
            <p className="text-xs text-stone-500 mt-1 mb-4">Only you two can ever read this chat</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Good morning ☀️', 'I miss you 🥺', 'Love you 💗'].map((t) => (
                <button key={t} type="button" onClick={() => setInputContent(t)} className="glass rounded-full px-3.5 py-1.5 text-sm text-stone-700 dark:text-stone-200 active:scale-95 transition-transform">
                  {t}
                </button>
              ))}
            </div>
          </motion.div>
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
                <div className="flex justify-center mt-5 mb-2 sticky top-1 z-10">
                  <span className="glass px-3 py-1 rounded-full text-[11px] font-semibold text-stone-500 dark:text-stone-300">
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
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              className="glass mt-3 mr-auto w-fit rounded-[1.35rem] rounded-bl-md px-4 py-3 flex gap-1"
              aria-label={`${partnerDisplayName} is typing`}
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="typing-dot w-2 h-2 rounded-full bg-[#E05A74]/70" style={{ animationDelay: `${i * 0.15}s` }} />
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
          className="glass absolute bottom-24 right-4 z-30 p-2.5 rounded-full text-[#E05A74] active:scale-90 hover:scale-105 transition-transform"
          title="Scroll to latest message"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Animated Reply Composer Banner */}
      <AnimatePresence>
        {activeReplyTarget && !isRecordingVoice && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="glass mx-3 mb-1 rounded-2xl px-4 py-2 flex items-center justify-between z-20 flex-shrink-0"
          >
            <div className="border-l-2 border-[#C95565] pl-3 text-xs flex-1 min-w-0 pr-2">
              <span className="font-bold text-[#C95565] flex items-center gap-1">
                {getReplyIcon(activeReplyTarget.message_type)}
                <span>
                  Replying to {activeReplyTarget.sender_id === currentUser?.id ? 'Yourself' : partnerDisplayName}
                </span>
              </span>
              <p className="text-stone-600 dark:text-stone-300 truncate max-w-sm mt-0.5 text-xs">
                {activeReplyTarget.deleted ? 'This message was deleted.' : activeReplyTarget.content}
              </p>
            </div>
            <button
              onClick={() => setActiveReplyTarget(null)}
              className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 active-scale"
              title="Cancel Reply (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Input / Voice Note Recorder Footer */}
      <footer className="z-30 w-full px-2 sm:px-4 pt-1 pb-[max(env(safe-area-inset-bottom),0.6rem)] flex-shrink-0">
        {isRecordingVoice ? (
          /* Live Voice Note Recording Bar */
          <div className="glass flex items-center justify-between gap-3 max-w-3xl mx-auto rounded-[1.75rem] p-1.5">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2.5 rounded-full bg-rose-100 text-[#C95565] hover:bg-rose-200 active-scale"
              title="Discard Recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-3 bg-stone-100 dark:bg-stone-800/80 py-1.5 px-4 rounded-full">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping flex-shrink-0" />
              <span className="text-xs font-bold text-red-500 font-mono">
                {formatTimer(recordingSeconds)}
              </span>

              {/* Frequency Waveform Animation */}
              <div className="flex items-center gap-0.5 h-4 flex-1 justify-center max-w-[120px]">
                {[30, 60, 40, 90, 70, 50, 80, 40, 60, 100, 50, 30].map((h, i) => {
                  const dynamicH = Math.min(100, Math.max(20, h * (audioLevel / 40)));
                  return (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-[#C95565] transition-all duration-75"
                      style={{ height: isRecordingPaused ? '30%' : `${dynamicH}%` }}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={isRecordingPaused ? resumeRecording : pauseRecording}
                className="p-1.5 rounded-full text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 active-scale"
                title={isRecordingPaused ? 'Resume Recording' : 'Pause Recording'}
              >
                {isRecordingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={stopAndSendVoiceNote}
              className="w-10 h-10 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale hover:bg-[#B34757]"
              title="Send Voice Note"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        ) : (
          /* Standard Input Bar */
          <form onSubmit={handleSend} className="glass relative flex items-center gap-1.5 max-w-3xl mx-auto rounded-[1.75rem] p-1.5">
            {/* Attach menu: photos, camera, file */}
            <button
              type="button"
              onClick={() => setIsAttachMenuOpen((open) => !open)}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                isAttachMenuOpen ? 'bg-[#E05A74] text-white rotate-45' : 'bg-rose-50 dark:bg-white/5 text-[#E05A74] hover:bg-rose-100'
              }`}
              title="Attach"
              aria-label="Attach"
              aria-expanded={isAttachMenuOpen}
            >
              <Plus className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {isAttachMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="glass absolute bottom-full left-0 mb-2 rounded-2xl p-1.5 flex flex-col gap-0.5 min-w-[11rem] z-40"
                >
                  {[
                    { label: 'Photos & videos', icon: ImageIcon, title: 'Attach Images or Videos', onClick: () => galleryInputRef.current?.click() },
                    { label: 'Camera', icon: Camera, title: 'Take Photo or Video', onClick: () => cameraInputRef.current?.click() },
                    { label: 'File', icon: Paperclip, title: 'Attach Document or File', onClick: () => documentInputRef.current?.click() },
                  ].map(({ label, icon: Icon, title, onClick }, i) => (
                    <motion.button
                      key={label}
                      type="button"
                      title={title}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        onClick();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-rose-50 dark:hover:bg-white/5"
                    >
                      <span className="w-8 h-8 rounded-full btn-gloss flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                      {label}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 relative flex items-center">
              <input
                ref={inputRef}
                type="text"
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
                }}
                placeholder={
                  editingMessage
                    ? 'Edit message...'
                    : activeReplyTarget
                    ? 'Type your reply...'
                    : 'Type a message...'
                }
                className="w-full bg-transparent text-stone-900 dark:text-stone-100 text-[15px] pl-2 pr-9 py-2 focus:outline-none placeholder:text-stone-400"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedMessage(null);
                  setIsEmojiPickerOpen((prev) => !prev);
                }}
                className="absolute right-1 p-1 text-stone-400 hover:text-[#E05A74] transition-colors"
                title="Emoji Picker"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            {/* One button: mic when empty, glossy send while typing (switches instantly) */}
            <motion.button
              type={inputContent.trim() ? 'submit' : 'button'}
              onClick={inputContent.trim() ? undefined : startRecording}
              whileTap={{ scale: 0.85 }}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden transition-colors duration-200 ${
                inputContent.trim() ? 'btn-gloss' : 'bg-rose-50 dark:bg-white/5 text-[#E05A74] hover:bg-rose-100'
              }`}
              title={inputContent.trim() ? 'Send' : 'Record Voice Note'}
            >
              <AnimatePresence initial={false}>
                <motion.span
                  key={inputContent.trim() ? 'send' : 'mic'}
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ scale: 0.3, rotate: -90, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.3, rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {inputContent.trim() ? <Send className="w-4 h-4 ml-0.5" /> : <Mic className="w-5 h-5" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </form>
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
