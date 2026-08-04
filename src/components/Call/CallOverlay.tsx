import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallStore } from '../../store/useCallStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Avatar } from '../ui/Avatar';

/* ─── Ringing pulse rings ──────────────────────────────────────── */
const RingingRings: React.FC = () => (
  <div className="absolute inset-0 rounded-full pointer-events-none">
    {[1, 2, 3].map((i) => (
      <span
        key={i}
        className="absolute inset-0 rounded-full border-2 border-[#C95565]/40 animate-ping"
        style={{ animationDelay: `${(i - 1) * 0.4}s`, animationDuration: '1.6s' }}
      />
    ))}
  </div>
);

/* ─── Call action button ───────────────────────────────────────── */
const CallBtn: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  success?: boolean;
  size?: 'lg' | 'md';
}> = ({ onClick, icon, label, active, danger, success, size = 'md' }) => {
  const base = size === 'lg' ? 'w-18 h-18' : 'w-14 h-14';
  const color = danger
    ? 'bg-red-600 hover:bg-red-500 text-white'
    : success
    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
    : active
    ? 'bg-[#C95565] hover:bg-[#B34757] text-white'
    : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md';

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className={`${base} rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${color}`}
        style={{ width: size === 'lg' ? '72px' : '56px', height: size === 'lg' ? '72px' : '56px' }}
        aria-label={label}
      >
        {icon}
      </button>
      <span className="text-[11px] font-semibold text-white/70">{label}</span>
    </div>
  );
};

/* ─── Main CallOverlay ─────────────────────────────────────────── */
export const CallOverlay: React.FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());

  const {
    currentCall,
    localStream,
    remoteStream,
    callSeconds,
    isMuted,
    isSpeakerOn,
    connectionState,
    permissionError,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    listenToSignaling,
    clearPermissionError,
  } = useCallStore();

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Wire signaling once ── */
  useEffect(() => {
    if (currentUser) {
      const cleanup = listenToSignaling(currentUser.id);
      return cleanup;
    }
  }, [currentUser?.id]);

  /* ── Bind remote audio stream ── */
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  /* ── Keyboard: Space = mute, Esc = end, Enter = accept ── */
  useEffect(() => {
    if (!currentCall) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endCall();
      } else if (e.key === 'Enter' && currentCall.state === 'incoming') {
        e.preventDefault();
        acceptCall();
      } else if (e.key === ' ' && currentCall.state === 'connected') {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentCall, acceptCall, endCall, toggleMute]);

  const partnerDisplayName = currentUser?.nickname || partnerUser.display_name;

  const formatTimer = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isRinging = currentCall?.state === 'outgoing' || currentCall?.state === 'incoming';
  const isConnected = currentCall?.state === 'connected';
  const isReconnecting = connectionState === 'disconnected' || connectionState === 'failed';

  const statusLabel = () => {
    if (!currentCall) return '';
    if (currentCall.state === 'outgoing') return 'Ringing…';
    if (currentCall.state === 'incoming') return 'Incoming voice call';
    if (isReconnecting) return 'Reconnecting…';
    if (isConnected) return formatTimer(callSeconds);
    return '';
  };

  return (
    <>
      {/* Hidden audio element for remote stream */}
      <audio id="ivy-remote-audio" ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Permission Error Banner / Dialog */}
      <AnimatePresence>
        {permissionError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-[60] bg-rose-900/95 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md border border-rose-500/40 flex flex-col gap-2"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-300 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">{permissionError}</div>
              <button
                onClick={clearPermissionError}
                className="text-white/70 hover:text-white font-bold text-xs ml-2 p-1"
                aria-label="Dismiss message"
              >
                Dismiss
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-rose-700/40">
              <button
                onClick={async () => {
                  clearPermissionError();
                  if (currentUser && partnerUser) {
                    useCallStore.getState().startCall(currentUser.id, partnerUser.id, 'audio');
                  }
                }}
                className="px-3 py-1 bg-white text-rose-900 font-bold text-xs rounded-full hover:bg-rose-100 transition-all active:scale-95"
              >
                Retry Call
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Call Overlay */}
      <AnimatePresence>
        {currentCall && (
          <motion.div
            key="call-overlay"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Voice Call"
          >
            {/* Gradient Background */}
            <div
              className="absolute inset-0 z-0"
              style={{
                background: isConnected
                  ? 'linear-gradient(160deg, #1a0a10 0%, #2d0f1b 40%, #1a0a10 100%)'
                  : 'linear-gradient(160deg, #0f0a1a 0%, #1b1028 40%, #0f0a1a 100%)',
              }}
            />

            {/* Ambient glowing blob behind avatar */}
            <div
              className="absolute top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none z-0"
              style={{
                background: isConnected
                  ? 'radial-gradient(circle, rgba(201,85,101,0.25) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(139,92,246,0.20) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />

            {/* ── Top: status bar ── */}
            <div className="relative z-10 w-full flex items-center justify-between px-6 pt-12">
              {/* Network indicator */}
              <div className="flex items-center gap-1.5">
                {isReconnecting ? (
                  <>
                    <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-amber-400 text-xs font-semibold">Reconnecting</span>
                  </>
                ) : isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 text-xs font-semibold">Connected</span>
                  </>
                ) : (
                  <span className="text-white/40 text-xs">Ivy Voice</span>
                )}
              </div>

              {/* Call type badge */}
              <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/60 text-[11px] font-bold">
                Voice Call
              </div>
            </div>

            {/* ── Center: Avatar + name + status ── */}
            <div className="relative z-10 flex flex-col items-center text-center px-6">
              {/* Avatar with pulse rings */}
              <div className="relative mb-6">
                {isRinging && <RingingRings />}
                <motion.div
                  animate={isRinging ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                >
                  <Avatar
                    src={partnerUser.avatar_url}
                    name={partnerDisplayName}
                    size="xl"
                    className="border-4 border-[#C95565]/50 shadow-2xl"
                  />
                </motion.div>
              </div>

              {/* Partner Name */}
              <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
                {partnerDisplayName}
              </h1>

              {/* Status label */}
              <motion.p
                key={statusLabel()}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-base font-semibold ${
                  isReconnecting
                    ? 'text-amber-400 animate-pulse'
                    : isConnected
                    ? 'text-emerald-400 tabular-nums'
                    : 'text-white/60'
                }`}
              >
                {statusLabel()}
              </motion.p>

              {/* Muted indicator badge */}
              {isConnected && isMuted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C95565]/30 border border-[#C95565]/50"
                >
                  <MicOff className="w-3.5 h-3.5 text-[#C95565]" />
                  <span className="text-[11px] font-bold text-[#C95565]">Microphone muted</span>
                </motion.div>
              )}
            </div>

            {/* ── Bottom: Controls ── */}
            <div className="relative z-10 w-full px-8 pb-16">
              {currentCall.state === 'incoming' ? (
                /* Incoming call – Decline + Accept */
                <div className="flex items-center justify-around">
                  <CallBtn
                    onClick={rejectCall}
                    icon={<PhoneOff className="w-7 h-7" />}
                    label="Decline"
                    danger
                    size="lg"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 1.0, ease: 'easeInOut' }}
                  >
                    <CallBtn
                      onClick={acceptCall}
                      icon={<Phone className="w-7 h-7" />}
                      label="Accept"
                      success
                      size="lg"
                    />
                  </motion.div>
                </div>
              ) : (
                /* Outgoing or Connected – Mute + Speaker + End */
                <div className="flex items-center justify-around">
                  <CallBtn
                    onClick={toggleMute}
                    icon={isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    label={isMuted ? 'Unmute' : 'Mute'}
                    active={isMuted}
                  />

                  <CallBtn
                    onClick={endCall}
                    icon={<PhoneOff className="w-7 h-7" />}
                    label="End"
                    danger
                    size="lg"
                  />

                  <CallBtn
                    onClick={toggleSpeaker}
                    icon={isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                    label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
                    active={!isSpeakerOn}
                  />
                </div>
              )}

              {/* Reconnecting indicator */}
              {isReconnecting && (
                <div className="mt-6 flex items-center justify-center gap-2 text-amber-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-semibold">Attempting to reconnect…</span>
                </div>
              )}

              {/* Keyboard shortcut hint (desktop) */}
              {isConnected && (
                <p className="mt-4 text-center text-[10px] text-white/25 select-none">
                  Space to mute · Esc to end call
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
