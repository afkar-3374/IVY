import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Video,
  VideoOff,
  CameraIcon,
  Maximize2,
  Minimize2,
  FlipHorizontal,
} from 'lucide-react';
import { useCallStore } from '../../store/useCallStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Avatar } from '../ui/Avatar';

/* ─── Ringing pulse rings ──────────────────────────────────────── */
const RingingRings: React.FC<{ color?: string }> = ({ color = '#C95565' }) => (
  <div className="absolute inset-0 rounded-full pointer-events-none">
    {[1, 2, 3].map((i) => (
      <span
        key={i}
        className="absolute inset-0 rounded-full border-2 animate-ping"
        style={{
          borderColor: `${color}60`,
          animationDelay: `${(i - 1) * 0.4}s`,
          animationDuration: '1.6s',
        }}
      />
    ))}
  </div>
);

/* ─── Call action button ───────────────────────────────────────── */
interface CallBtnProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  success?: boolean;
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
}

const CallBtn: React.FC<CallBtnProps> = ({
  onClick,
  icon,
  label,
  active,
  danger,
  success,
  size = 'md',
  disabled = false,
}) => {
  const dim = size === 'lg' ? 72 : size === 'sm' ? 44 : 56;
  const iconSize = size === 'lg' ? 'w-7 h-7' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  const color = danger
    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'
    : success
    ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-900/40'
    : active
    ? 'bg-[#C95565] hover:bg-[#B34757] text-white shadow-rose-900/40'
    : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md shadow-black/20';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${color}`}
        style={{ width: dim, height: dim }}
        aria-label={label}
      >
        <span className={iconSize}>{icon}</span>
      </button>
      <span className="text-[10px] font-semibold text-white/60 select-none">{label}</span>
    </div>
  );
};

/* ─── Network quality dot ──────────────────────────────────────── */
const NetworkDot: React.FC<{ state: RTCPeerConnectionState | null; isReconnecting: boolean }> = ({
  state,
  isReconnecting,
}) => {
  if (isReconnecting)
    return (
      <div className="flex items-center gap-1.5">
        <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span className="text-amber-400 text-[11px] font-bold">Reconnecting…</span>
      </div>
    );
  if (state === 'connected')
    return (
      <div className="flex items-center gap-1.5">
        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-emerald-400 text-[11px] font-bold">Connected</span>
      </div>
    );
  return <span className="text-white/30 text-[11px]">Ivy Call</span>;
};

/* ──────────────────────────────────────────────────────────────── */
/*  MAIN COMPONENT                                                  */
/* ──────────────────────────────────────────────────────────────── */
export const CallOverlay: React.FC = () => {
  const currentUser = useAuthStore((s) => s.user);
  const partnerUser = useAuthStore((s) => s.getPartnerProfile());

  const {
    currentCall,
    localStream,
    remoteStream,
    callSeconds,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    connectionState,
    permissionError,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    switchCamera,
    listenToSignaling,
    recoverAfterResume,
    clearPermissionError,
  } = useCallStore();

  /* ── Refs ── */
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /* ── Local state ── */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [localPipMinimized, setLocalPipMinimized] = useState(false);
  const controlsHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVideoCall = currentCall?.call_type === 'video';
  const isRinging = currentCall?.state === 'outgoing' || currentCall?.state === 'incoming';
  const isConnected = currentCall?.state === 'connected';
  const isReconnecting = connectionState === 'disconnected' || connectionState === 'failed';
  const partnerDisplayName = currentUser?.nickname || partnerUser.display_name;

  /* ── Wire signaling once ── */
  useEffect(() => {
    if (currentUser) {
      return listenToSignaling(currentUser.id);
    }
  }, [currentUser?.id]);

  /* ── Recovery on resume / online ── */
  useEffect(() => {
    const recover = () => recoverAfterResume();
    const onVisible = () => { if (document.visibilityState === 'visible') recover(); };
    window.addEventListener('online', recover);
    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', recover);
      window.removeEventListener('pageshow', recover);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [recoverAfterResume]);

  /* ── Bind remote audio ── */
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  /* ── Bind remote video ── */
  useEffect(() => {
    if (!isVideoCall) return;
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      // Detect when remote video track becomes active
      const videoTrack = remoteStream.getVideoTracks()[0];
      if (videoTrack) {
        setRemoteHasVideo(!videoTrack.muted && videoTrack.enabled);
        videoTrack.onmute = () => setRemoteHasVideo(false);
        videoTrack.onunmute = () => setRemoteHasVideo(true);
        videoTrack.onended = () => setRemoteHasVideo(false);
      }
    }
  }, [remoteStream, isVideoCall]);

  /* ── Bind local preview ── */
  useEffect(() => {
    if (!isVideoCall) return;
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoCall]);

  /* ── Reset remoteHasVideo when call ends or new call starts ── */
  useEffect(() => {
    if (!currentCall) setRemoteHasVideo(false);
  }, [currentCall]);

  /* ── Auto-hide controls during connected video call ── */
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current);
    if (isConnected && isVideoCall) {
      controlsHideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [isConnected, isVideoCall]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current); };
  }, [isConnected, isVideoCall, resetControlsTimer]);

  /* ── Fullscreen handling ── */
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* Fullscreen not supported — silently ignore */ }
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    if (!currentCall) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else endCall();
      } else if (e.key === 'Enter' && currentCall.state === 'incoming') {
        e.preventDefault();
        acceptCall();
      } else if (e.key === ' ' && currentCall.state === 'connected') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'v' && currentCall.state === 'connected' && isVideoCall) {
        e.preventDefault();
        toggleVideo();
      } else if (e.key === 'f' && currentCall.state === 'connected' && isVideoCall) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentCall, acceptCall, endCall, toggleMute, toggleVideo, isVideoCall]);

  /* ── Timer formatter ── */
  const formatTimer = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const statusLabel = () => {
    if (!currentCall) return '';
    if (currentCall.state === 'outgoing') return isVideoCall ? 'Ringing… (Video)' : 'Ringing…';
    if (currentCall.state === 'incoming') return isVideoCall ? 'Incoming video call' : 'Incoming voice call';
    if (isReconnecting) return 'Reconnecting…';
    if (isConnected) return formatTimer(callSeconds);
    return '';
  };

  /* ════════════════════════════════════════════════════════════════
     VOICE CALL UI  (avatar-based dark screen — unchanged design)
  ════════════════════════════════════════════════════════════════ */
  const VoiceCallScreen = () => (
    <motion.div
      key="voice-call-overlay"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Voice Call"
    >
      {/* Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: isConnected
            ? 'linear-gradient(160deg,#1a0a10 0%,#2d0f1b 40%,#1a0a10 100%)'
            : 'linear-gradient(160deg,#0f0a1a 0%,#1b1028 40%,#0f0a1a 100%)',
        }}
      />
      {/* Ambient glow */}
      <div
        className="absolute top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none z-0"
        style={{
          background: isConnected
            ? 'radial-gradient(circle,rgba(201,85,101,0.25) 0%,transparent 70%)'
            : 'radial-gradient(circle,rgba(139,92,246,0.20) 0%,transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Top status bar */}
      <div className="relative z-10 w-full flex items-center justify-between px-6 pt-12">
        <NetworkDot state={connectionState} isReconnecting={isReconnecting} />
        <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/60 text-[11px] font-bold">
          Voice Call
        </div>
      </div>

      {/* Center */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
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
        <h1 className="text-3xl font-bold text-white tracking-tight mb-1">{partnerDisplayName}</h1>
        <motion.p
          key={statusLabel()}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-base font-semibold ${
            isReconnecting ? 'text-amber-400 animate-pulse' : isConnected ? 'text-emerald-400 tabular-nums' : 'text-white/60'
          }`}
        >
          {statusLabel()}
        </motion.p>
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

      {/* Controls */}
      <div className="relative z-10 w-full px-8 pb-16">
        {currentCall?.state === 'incoming' ? (
          <div className="flex items-center justify-around">
            <CallBtn onClick={rejectCall} icon={<PhoneOff />} label="Decline" danger size="lg" />
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.0, ease: 'easeInOut' }}>
              <CallBtn onClick={acceptCall} icon={<Phone />} label="Accept" success size="lg" />
            </motion.div>
          </div>
        ) : (
          <div className="flex items-center justify-around">
            <CallBtn onClick={toggleMute} icon={isMuted ? <MicOff /> : <Mic />} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} />
            <CallBtn onClick={endCall} icon={<PhoneOff />} label="End" danger size="lg" />
            <CallBtn onClick={toggleSpeaker} icon={isSpeakerOn ? <Volume2 /> : <VolumeX />} label={isSpeakerOn ? 'Speaker' : 'Earpiece'} active={!isSpeakerOn} />
          </div>
        )}
        {isReconnecting && (
          <div className="mt-6 flex items-center justify-center gap-2 text-amber-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs font-semibold">Attempting to reconnect…</span>
          </div>
        )}
        {isConnected && (
          <p className="mt-4 text-center text-[10px] text-white/25 select-none">
            Space to mute · Esc to end call
          </p>
        )}
      </div>
    </motion.div>
  );

  /* ════════════════════════════════════════════════════════════════
     VIDEO CALL UI  (full-screen video with PiP local preview)
  ════════════════════════════════════════════════════════════════ */
  const VideoCallScreen = () => (
    <motion.div
      key="video-call-overlay"
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 bg-black overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Video Call"
      onClick={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* ── Remote video (full screen) ── */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          remoteHasVideo && isConnected ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Partner's video"
      />

      {/* ── Avatar shown when remote video not ready ── */}
      <AnimatePresence>
        {(!remoteHasVideo || !isConnected) && (
          <motion.div
            key="remote-avatar-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              background: isConnected
                ? 'linear-gradient(160deg,#0d0612 0%,#1a0d24 50%,#0d0612 100%)'
                : 'linear-gradient(160deg,#080612 0%,#120a1e 50%,#080612 100%)',
            }}
          >
            {/* Ambient glow */}
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle,rgba(139,92,246,0.3) 0%,transparent 70%)',
                filter: 'blur(50px)',
              }}
            />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="relative">
                {isRinging && <RingingRings color="#8B5CF6" />}
                <motion.div
                  animate={isRinging ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                >
                  <Avatar
                    src={partnerUser.avatar_url}
                    name={partnerDisplayName}
                    size="xl"
                    className="border-4 border-violet-500/40 shadow-2xl"
                  />
                </motion.div>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-1">{partnerDisplayName}</h1>
                <motion.p
                  key={statusLabel()}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm font-semibold ${
                    isReconnecting
                      ? 'text-amber-400 animate-pulse'
                      : isConnected
                      ? 'text-violet-300'
                      : 'text-white/50'
                  }`}
                >
                  {isConnected ? 'Camera is off' : statusLabel()}
                </motion.p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Local video PiP (bottom-right corner) ── */}
      <AnimatePresence>
        {isConnected && !localPipMinimized && (
          <motion.div
            key="local-pip"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-32 right-4 z-20 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 cursor-pointer active:scale-95 transition-transform"
            style={{ width: 100, height: 140 }}
            onClick={(e) => { e.stopPropagation(); setLocalPipMinimized(true); }}
            title="Tap to minimize preview"
          >
            {isVideoOff ? (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-white/40" />
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' /* mirror front cam */ }}
                aria-label="Your camera preview"
              />
            )}
            {/* Minimize hint */}
            <div className="absolute bottom-1 right-1 bg-black/50 rounded-full p-0.5">
              <Minimize2 className="w-3 h-3 text-white/60" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Minimized PiP restore button ── */}
      <AnimatePresence>
        {isConnected && localPipMinimized && (
          <motion.button
            key="pip-restore"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-32 right-4 z-20 w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl active:scale-90 transition-transform"
            onClick={(e) => { e.stopPropagation(); setLocalPipMinimized(false); }}
            aria-label="Restore camera preview"
          >
            <CameraIcon className="w-5 h-5 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Top bar (status + timer + network) ── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            key="top-bar"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 z-30 px-5 pt-10 pb-8"
            style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)' }}
          >
            <div className="flex items-center justify-between">
              <NetworkDot state={connectionState} isReconnecting={isReconnecting} />
              <div className="flex items-center gap-2">
                {isConnected && (
                  <span className="text-white font-bold text-sm tabular-nums bg-black/30 px-2 py-0.5 rounded-full">
                    {formatTimer(callSeconds)}
                  </span>
                )}
                <div className="px-2 py-0.5 rounded-full bg-violet-600/80 text-white text-[10px] font-bold backdrop-blur-sm">
                  Video Call
                </div>
              </div>
            </div>
            {isConnected && isMuted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-[#C95565]/80 border border-[#C95565]"
              >
                <MicOff className="w-3 h-3 text-white" />
                <span className="text-[10px] font-bold text-white">Muted</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Partner name overlay (shown when video is on) */}
      <AnimatePresence>
        {controlsVisible && remoteHasVideo && isConnected && (
          <motion.div
            key="partner-name"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-28 left-4 z-30"
          >
            <span className="text-white text-sm font-bold drop-shadow-lg bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-sm">
              {partnerDisplayName}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom controls ── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            key="controls-bar"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-10 pt-12"
            style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 100%)' }}
          >
            {currentCall?.state === 'incoming' ? (
              /* Incoming: Decline + Accept */
              <div className="flex items-center justify-around mb-2">
                <CallBtn onClick={rejectCall} icon={<PhoneOff />} label="Decline" danger size="lg" />
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.0, ease: 'easeInOut' }}
                >
                  <CallBtn onClick={acceptCall} icon={<Video />} label="Accept" success size="lg" />
                </motion.div>
              </div>
            ) : (
              /* Outgoing / Connected: full control row */
              <div className="flex items-end justify-around">
                <CallBtn
                  onClick={toggleMute}
                  icon={isMuted ? <MicOff /> : <Mic />}
                  label={isMuted ? 'Unmute' : 'Mute'}
                  active={isMuted}
                />
                <CallBtn
                  onClick={toggleVideo}
                  icon={isVideoOff ? <VideoOff /> : <Video />}
                  label={isVideoOff ? 'Cam Off' : 'Camera'}
                  active={isVideoOff}
                />
                <CallBtn onClick={endCall} icon={<PhoneOff />} label="End" danger size="lg" />
                <CallBtn
                  onClick={toggleSpeaker}
                  icon={isSpeakerOn ? <Volume2 /> : <VolumeX />}
                  label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
                  active={!isSpeakerOn}
                />
                <CallBtn
                  onClick={() => switchCamera()}
                  icon={<FlipHorizontal />}
                  label="Flip"
                  disabled={!isConnected}
                />
              </div>
            )}

            {/* Secondary row: Fullscreen */}
            {isConnected && (
              <div className="flex justify-center mt-4 gap-6">
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors text-[11px] font-semibold"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
              </div>
            )}

            {isReconnecting && (
              <div className="mt-4 flex items-center justify-center gap-2 text-amber-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs font-semibold">Attempting to reconnect…</span>
              </div>
            )}

            {isConnected && (
              <p className="mt-3 text-center text-[10px] text-white/20 select-none">
                Space · mute &nbsp;|&nbsp; V · camera &nbsp;|&nbsp; F · fullscreen &nbsp;|&nbsp; Esc · end
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap hint when controls are hidden */}
      <AnimatePresence>
        {!controlsVisible && isConnected && (
          <motion.div
            key="tap-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-white/25 text-[11px] select-none pointer-events-none"
          >
            Tap to show controls
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Hidden audio element for remote audio (always active) */}
      <audio id="ivy-remote-audio" ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Permission Error Banner */}
      <AnimatePresence>
        {permissionError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-[60] bg-rose-900/95 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md border border-rose-500/40"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-300 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-medium leading-snug">{permissionError}</div>
              <button
                onClick={clearPermissionError}
                className="text-white/70 hover:text-white font-bold text-xs ml-2 p-1"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-rose-700/40 mt-2">
              <button
                onClick={() => {
                  clearPermissionError();
                  if (currentUser && partnerUser) {
                    const callType = currentCall?.call_type ?? 'audio';
                    useCallStore.getState().startCall(currentUser.id, partnerUser.id, callType);
                  }
                }}
                className="px-3 py-1 bg-white text-rose-900 font-bold text-xs rounded-full hover:bg-rose-100 transition-all active:scale-95"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Call Screen */}
      <AnimatePresence>
        {currentCall && (isVideoCall ? <VideoCallScreen key="video" /> : <VoiceCallScreen key="voice" />)}
      </AnimatePresence>
    </>
  );
};
