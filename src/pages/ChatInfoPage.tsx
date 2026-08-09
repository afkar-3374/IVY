import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Search,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Link as LinkIcon,
  Star,
  Pin,
  Palette,
  Bell,
  ChevronRight,
  Download,
  Copy,
  ExternalLink,
  HardDrive,
  Play,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePresence } from '../hooks/usePresence';
import { useChatStore } from '../store/useChatStore';
import { useCallStore } from '../store/useCallStore';
import { Avatar } from '../components/ui/Avatar';
import { Switch } from '../components/ui/Switch';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import { extractLinksFromMessages } from '../utils/linkExtractor';
import { calculateStorageUsage } from '../utils/storageCalculator';
import { getFileCategory, getFileExtensionLabel } from '../utils/fileIcons';
import { formatDateSeparator, formatMessageTime } from '../utils/date';
import { AudioPlayer } from '../components/Chat/AudioPlayer';
import { MediaViewerModal } from '../components/Chat/MediaViewerModal';
import type { Message } from '../types';

type ActiveMediaTab = 'all' | 'photos' | 'videos' | 'voice' | 'files' | 'links' | 'starred' | 'pinned' | 'calls';

const ChatInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const { subtext, partnerPresence } = usePresence();
  const messages = useChatStore((state) => state.messages);
  const setTargetMessageId = useChatStore((state) => state.setTargetMessageId);
  const toggleStar = useChatStore((state) => state.toggleStar);
  const togglePin = useChatStore((state) => state.togglePin);

  const callHistory = useCallStore((state) => state.callHistory);
  const loadCallHistory = useCallStore((state) => state.loadCallHistory);

  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled);
  const addToast = useUIStore((state) => state.addToast);

  const [activeTab, setActiveTab] = useState<ActiveMediaTab>('all');
  const [selectedMediaMessage, setSelectedMediaMessage] = useState<Message | null>(null);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);

  const partnerDisplayName = currentUser?.nickname || partnerUser.display_name;

  // Filter Media Categories
  const photos = messages.filter(
    (m) => !m.deleted && (m.message_type === 'image' || (typeof m.content === 'string' && m.content.startsWith('data:image/')))
  );
  const videos = messages.filter(
    (m) => !m.deleted && (m.message_type === 'video' || (typeof m.content === 'string' && m.content.startsWith('data:video/')))
  );
  const voiceNotes = messages.filter(
    (m) => !m.deleted && (m.message_type === 'voice' || (typeof m.content === 'string' && m.content.startsWith('data:audio/')))
  );
  const files = messages.filter(
    (m) =>
      !m.deleted &&
      (m.message_type === 'document' ||
        m.message_type === 'file' ||
        (!photos.includes(m) && !videos.includes(m) && !voiceNotes.includes(m) && m.message_type !== 'text' && m.message_type !== 'system'))
  );
  const extractedLinks = extractLinksFromMessages(messages);
  const starredMessages = messages.filter((m) => !m.deleted && m.starred);
  const pinnedMessages = messages.filter((m) => !m.deleted && m.pinned);

  const storageUsage = calculateStorageUsage(messages);

  const handleJumpToMessage = (localUuid: string) => {
    setTargetMessageId(localUuid);
    navigate('/chat');
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    addToast('Link copied to clipboard', 'info');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FDF8F6] dark:bg-[#16151A] pb-24">
      {/* Header Bar */}
      <div className="p-4 flex items-center justify-between sticky top-0 z-30 bg-white/90 dark:bg-[#1E1D24]/90 backdrop-blur-md border-b border-stone-100 dark:border-stone-800">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 active-scale"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Chat Information</h2>
        <div className="w-9" />
      </div>

      {/* Profile Header Hero */}
      <div className="flex flex-col items-center p-6 text-center">
        <Avatar
          src={partnerUser.avatar_url}
          name={partnerDisplayName}
          size="xl"
          isOnline={partnerPresence.online}
          className="mb-3"
        />
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-0.5">
          {partnerDisplayName}
        </h1>
        <p className="text-xs font-semibold text-[#C95565] mb-2">{subtext}</p>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs italic mb-4">
          "{partnerUser.about || 'Together forever ❤️'}"
        </p>

        {/* Quick Action Buttons */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (currentUser && partnerUser) {
                useCallStore.getState().startCall(currentUser.id, partnerUser.id, 'audio');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#C95565] text-white shadow-soft text-xs font-bold active-scale hover:bg-[#B34757] transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>Voice Call</span>
          </button>
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white dark:bg-[#1E1D24] shadow-soft border border-stone-100 dark:border-stone-800 text-xs font-bold text-stone-800 dark:text-stone-200 active-scale"
          >
            <Search className="w-4 h-4 text-[#C95565]" />
            <span>Search</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white dark:bg-[#1E1D24] shadow-soft border border-stone-100 dark:border-stone-800 text-xs font-bold text-stone-800 dark:text-stone-200 active-scale"
          >
            <Palette className="w-4 h-4 text-[#C95565]" />
            <span>Theme</span>
          </button>
        </div>
      </div>

      {/* Storage & Footprint Summary Card */}
      <div className="px-4 mb-4">
        <div className="bg-white dark:bg-[#1E1D24] rounded-3xl p-4 shadow-soft border border-stone-100 dark:border-stone-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#C95565]" />
              <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">Storage & Cache</h3>
            </div>
            <span className="text-xs font-extrabold text-[#C95565]">{storageUsage.formattedTotal}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="bg-stone-50 dark:bg-stone-800/50 p-2 rounded-2xl border border-stone-100 dark:border-stone-700/50">
              <span className="text-stone-400 block text-[10px]">Media</span>
              <span className="font-bold text-stone-800 dark:text-stone-200">{storageUsage.formattedMedia}</span>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800/50 p-2 rounded-2xl border border-stone-100 dark:border-stone-700/50">
              <span className="text-stone-400 block text-[10px]">Documents</span>
              <span className="font-bold text-stone-800 dark:text-stone-200">{storageUsage.formattedDocs}</span>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800/50 p-2 rounded-2xl border border-stone-100 dark:border-stone-700/50">
              <span className="text-stone-400 block text-[10px]">Offline Cache</span>
              <span className="font-bold text-[#C95565]">{storageUsage.formattedTotal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Media Filter Tabs Bar */}
      <div className="px-4 mb-3 overflow-x-auto pb-1 flex items-center gap-1.5 scrollbar-none">
        {(
          [
            { id: 'all', label: 'All', count: messages.length },
            { id: 'calls', label: 'Calls', count: callHistory.length },
            { id: 'photos', label: 'Photos', count: photos.length },
            { id: 'videos', label: 'Videos', count: videos.length },
            { id: 'voice', label: 'Voice Notes', count: voiceNotes.length },
            { id: 'files', label: 'Files', count: files.length },
            { id: 'links', label: 'Links', count: extractedLinks.length },
            { id: 'starred', label: 'Starred', count: starredMessages.length },
            { id: 'pinned', label: 'Pinned', count: pinnedMessages.length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveMediaTab)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all active-scale ${
              activeTab === tab.id
                ? 'bg-[#C95565] text-white shadow-soft'
                : 'bg-white dark:bg-[#1E1D24] text-stone-600 dark:text-stone-300 border border-stone-100 dark:border-stone-800'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Shared Media Items Explorer Section */}
      <div className="px-4">
        <div className="bg-white dark:bg-[#1E1D24] rounded-3xl p-4 shadow-soft border border-stone-100 dark:border-stone-800/80 min-h-[250px]">
          {/* Call History View */}
          {(activeTab === 'all' || activeTab === 'calls') && callHistory.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-3 flex items-center justify-between">
                <span>Call History ({callHistory.length})</span>
                {activeTab === 'all' && (
                  <button onClick={() => setActiveTab('calls')} className="text-[#C95565] hover:underline">
                    See All
                  </button>
                )}
              </h3>
              <div className="space-y-2">
                {callHistory.slice(0, activeTab === 'calls' ? 50 : 5).map((log) => {
                  const isOutgoing = log.caller_id === currentUser?.id;
                  const statusColor =
                    log.status === 'completed'
                      ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/50'
                      : log.status === 'missed'
                      ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200/50'
                      : 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200/50';

                  const formatDur = (secs: number) => {
                    if (!secs || secs === 0) return 'No answer';
                    const m = Math.floor(secs / 60);
                    const s = secs % 60;
                    return m > 0 ? `${m}m ${s}s` : `${s}s`;
                  };

                  const CallIcon = () => {
                    if (log.status === 'missed') return <PhoneMissed className="w-4 h-4" />;
                    if (log.status === 'rejected' || log.status === 'busy') return <PhoneOff className="w-4 h-4" />;
                    if (log.call_type === 'video') return <Video className="w-4 h-4" />;
                    return <PhoneCall className="w-4 h-4" />;
                  };

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${statusColor}`}>
                          <CallIcon />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                              {partnerDisplayName}
                            </span>
                            <span className="text-[10px] font-semibold text-stone-400">
                              · {isOutgoing ? 'Outgoing' : 'Incoming'}
                            </span>
                            {log.call_type === 'video' && (
                              <span className="text-[9px] font-bold text-violet-500 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded-full">
                                Video
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400">
                            {formatDateSeparator(log.created_at)} at {formatMessageTime(log.created_at)} ·{' '}
                            <span className="font-medium">{formatDur(log.duration_seconds)}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (currentUser && partnerUser) {
                            useCallStore.getState().startCall(currentUser.id, partnerUser.id, log.call_type);
                          }
                        }}
                        className="p-2 rounded-full bg-white dark:bg-stone-800 shadow-soft text-[#C95565] hover:scale-110 active:scale-95 transition-all"
                        title={log.call_type === 'video' ? 'Video call again' : 'Call again'}
                        aria-label={log.call_type === 'video' ? 'Video call again' : 'Call again'}
                      >
                        {log.call_type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Photos View */}
          {(activeTab === 'all' || activeTab === 'photos') && photos.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2 flex items-center justify-between">
                <span>Photos ({photos.length})</span>
                {activeTab === 'all' && (
                  <button onClick={() => setActiveTab('photos')} className="text-[#C95565] hover:underline">
                    See All
                  </button>
                )}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.slice(0, activeTab === 'photos' ? 50 : 8).map((m) => (
                  <div
                    key={m.local_uuid}
                    onClick={() => {
                      setSelectedMediaMessage(m);
                      setIsMediaViewerOpen(true);
                    }}
                    className="aspect-square rounded-2xl overflow-hidden shadow-soft cursor-pointer relative group bg-stone-100 dark:bg-stone-800"
                  >
                    <img src={m.content} alt="Photo" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos View */}
          {(activeTab === 'all' || activeTab === 'videos') && videos.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2 flex items-center justify-between">
                <span>Videos ({videos.length})</span>
                {activeTab === 'all' && (
                  <button onClick={() => setActiveTab('videos')} className="text-[#C95565] hover:underline">
                    See All
                  </button>
                )}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {videos.slice(0, activeTab === 'videos' ? 50 : 8).map((m) => (
                  <div
                    key={m.local_uuid}
                    onClick={() => {
                      setSelectedMediaMessage(m);
                      setIsMediaViewerOpen(true);
                    }}
                    className="aspect-square rounded-2xl overflow-hidden shadow-soft cursor-pointer relative group bg-black"
                  >
                    <video src={m.content} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voice Notes View */}
          {(activeTab === 'all' || activeTab === 'voice') && voiceNotes.length > 0 && (
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2">
                Voice Notes ({voiceNotes.length})
              </h3>
              {voiceNotes.slice(0, activeTab === 'voice' ? 30 : 4).map((m) => (
                <div
                  key={m.local_uuid}
                  className="p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-700/60 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <AudioPlayer id={m.local_uuid} src={m.content} />
                  </div>
                  <button
                    onClick={() => handleJumpToMessage(m.local_uuid)}
                    className="text-[10px] font-bold text-[#C95565] hover:underline flex-shrink-0 px-2"
                  >
                    Jump to message
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Documents / Files View */}
          {(activeTab === 'all' || activeTab === 'files') && files.length > 0 && (
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2">
                Files & Documents ({files.length})
              </h3>
              {files.slice(0, activeTab === 'files' ? 30 : 4).map((m) => (
                <div
                  key={m.local_uuid}
                  className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-700/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-white dark:bg-stone-700 text-[#C95565]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                        Document Attachment
                      </p>
                      <p className="text-[10px] text-stone-400 font-semibold">
                        {getFileExtensionLabel(m.content)} • {formatMessageTime(m.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={m.content}
                      download="attachment"
                      className="p-1.5 rounded-full bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-[#C95565]"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleJumpToMessage(m.local_uuid)}
                      className="text-[10px] font-bold text-[#C95565] hover:underline"
                    >
                      Jump
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Links View */}
          {(activeTab === 'all' || activeTab === 'links') && extractedLinks.length > 0 && (
            <div className="mb-6 space-y-2">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2">
                Shared Links ({extractedLinks.length})
              </h3>
              {extractedLinks.slice(0, activeTab === 'links' ? 30 : 4).map((link) => (
                <div
                  key={link.id}
                  className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-700/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500">
                      <LinkIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">
                        {link.domain}
                      </p>
                      <p className="text-[10px] text-stone-400 truncate max-w-xs">{link.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleCopyLink(link.url)}
                      className="p-1.5 rounded-full bg-white dark:bg-stone-700 text-stone-500 hover:text-stone-800"
                      title="Copy link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-full bg-white dark:bg-stone-700 text-stone-500 hover:text-blue-500"
                      title="Open link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleJumpToMessage(link.messageLocalUuid)}
                      className="text-[10px] font-bold text-[#C95565] hover:underline px-1"
                    >
                      Jump
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Starred Messages View */}
          {activeTab === 'starred' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-amber-500 mb-2 flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-500" />
                <span>Starred Messages ({starredMessages.length})</span>
              </h3>
              {starredMessages.length === 0 ? (
                <p className="text-xs text-stone-400 italic text-center py-6">No starred messages yet.</p>
              ) : (
                starredMessages.map((m) => (
                  <div
                    key={m.local_uuid}
                    className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 flex items-center justify-between gap-3"
                  >
                    <p className="text-xs text-stone-800 dark:text-stone-200 truncate flex-1">{m.content}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => toggleStar(m.local_uuid)} className="text-amber-500 hover:text-stone-400">
                        <Star className="w-4 h-4 fill-amber-500" />
                      </button>
                      <button onClick={() => handleJumpToMessage(m.local_uuid)} className="text-[10px] font-bold text-[#C95565] hover:underline">
                        Jump
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pinned Messages View */}
          {activeTab === 'pinned' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#C95565] mb-2 flex items-center gap-1">
                <Pin className="w-4 h-4" />
                <span>Pinned Messages ({pinnedMessages.length})</span>
              </h3>
              {pinnedMessages.length === 0 ? (
                <p className="text-xs text-stone-400 italic text-center py-6">No pinned messages yet.</p>
              ) : (
                pinnedMessages.map((m) => (
                  <div
                    key={m.local_uuid}
                    className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 flex items-center justify-between gap-3"
                  >
                    <p className="text-xs text-stone-800 dark:text-stone-200 truncate flex-1">{m.content}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => togglePin(m.local_uuid)} className="text-[#C95565] hover:text-stone-400">
                        <Pin className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleJumpToMessage(m.local_uuid)} className="text-[10px] font-bold text-[#C95565] hover:underline">
                        Jump
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notifications Settings */}
      <div className="px-4 mt-4">
        <div className="bg-white dark:bg-[#1E1D24] rounded-3xl p-3.5 shadow-soft border border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500">
              <Bell className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Push Notifications</span>
          </div>
          <Switch checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        </div>
      </div>

      {/* Full-Screen Media Viewer */}
      <MediaViewerModal
        isOpen={isMediaViewerOpen}
        message={selectedMediaMessage}
        allMessages={messages}
        onClose={() => setIsMediaViewerOpen(false)}
      />
    </div>
  );
};

export default ChatInfoPage;
