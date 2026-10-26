import { create } from 'zustand';
import type { CallSession, CallType, CallHistoryRecord } from '../types';
import { callService, type SignalingEvent } from '../services/callService';
import { chatService } from '../services/chatService';
import { logger } from '../services/logger/logger';
import { ivyDb } from '../db/ivyDb';
import { useAuthStore } from './useAuthStore';
import { pushService } from '../services/pushService';
import { callSounds } from '../services/callSounds';
import { listAudioRoutes, preferredRoute, setOutputDevice, type AudioRoute } from '../services/audioRoutes';

const CALL_TIMEOUT_SECONDS = 45; // Unanswered call timeout
const RINGING_FALLBACK_SECONDS = 50; // Receiver stops ringing if the caller's end signal is lost
const RECONNECT_TIMEOUT_SECONDS = 20; // Connection loss timeout
const ICE_RESTART_DELAY_MS = 2000; // Grace period before trying to repair a dropped connection

interface CallStoreState {
  currentCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callSeconds: number;
  facingMode: 'user' | 'environment';
  isMuted: boolean;
  isVideoOff: boolean;
  /** Earpiece, speaker, Bluetooth... (empty when the browser picks the route itself, e.g. iPhone) */
  audioRoutes: AudioRoute[];
  audioRouteId: string | null;
  connectionState: RTCPeerConnectionState | null;
  permissionError: string | null;
  callHistory: CallHistoryRecord[];

  startCall: (callerId: string, receiverId: string, callType: CallType) => Promise<void>;
  receiveCallOffer: (callerId: string, receiverId: string, callType: CallType, offer: RTCSessionDescriptionInit) => void;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  /** Earpiece ↔ speaker; with Bluetooth or a headset connected the screen shows a picker instead. */
  toggleSpeaker: () => void;
  setAudioRoute: (id: string) => Promise<void>;
  refreshAudioRoutes: () => Promise<void>;
  switchCamera: () => Promise<void>;
  listenToSignaling: (userId: string) => () => void;
  recoverAfterResume: () => void;
  clearPermissionError: () => void;
  loadCallHistory: () => Promise<void>;
}

let callTimerInterval: NodeJS.Timeout | null = null;
let callTimeoutTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
const stopRingtone = () => callSounds.stop();

let routesWatcher: (() => void) | null = null;

/** Pick the starting route like a phone does and follow devices that connect or disconnect. */
const startAudioRouting = (get: () => CallStoreState) => {
  stopAudioRouting();
  void get().refreshAudioRoutes();
  const onChange = () => void get().refreshAudioRoutes();
  navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
  routesWatcher = () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
};

const NO_ROUTES = { audioRoutes: [] as AudioRoute[], audioRouteId: null };

const stopAudioRouting = () => {
  routesWatcher?.();
  routesWatcher = null;
};

/** Post a call note into the chat as the signed-in partner. */
const logCallMessage = (content: string) => {
  const me = useAuthStore.getState().user;
  if (!me) return;
  const partner = useAuthStore.getState().getPartnerProfile();
  void chatService.sendMessage({ sender_id: me.id, receiver_id: partner.id, content, message_type: 'system' });
};

let iceRestartTimer: NodeJS.Timeout | null = null;

const clearAllTimers = () => {
  if (iceRestartTimer) { clearTimeout(iceRestartTimer); iceRestartTimer = null; }
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  if (callTimeoutTimer) { clearTimeout(callTimeoutTimer); callTimeoutTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
};

const startCallTimer = (set: (fn: (s: CallStoreState) => Partial<CallStoreState>) => void) => {
  clearAllTimers();
  callTimerInterval = setInterval(() => {
    set((st) => ({ callSeconds: st.callSeconds + 1 }));
  }, 1000);
};

const addCallHistory = async (
  get: () => CallStoreState,
  set: (fn: (s: CallStoreState) => Partial<CallStoreState>) => void,
  status: CallHistoryRecord['status']
) => {
  const current = get().currentCall;
  const seconds = get().callSeconds;
  if (!current) return;

  const record: CallHistoryRecord = {
    id: `hist_${Date.now()}`,
    caller_id: current.caller_id,
    receiver_id: current.receiver_id,
    call_type: current.call_type,
    status,
    duration_seconds: seconds,
    created_at: new Date().toISOString(),
  };

  set((st) => ({ callHistory: [record, ...st.callHistory].slice(0, 100) }));
  try {
    await ivyDb.callLogs.put(record);
  } catch (e) {
    logger.warn('Failed to save call log to IndexedDB:', e);
  }
};


/**
 * Watch the WebRTC connection: the caller repairs drops with an ICE restart, and
 * either side hangs up if the connection stays down for RECONNECT_TIMEOUT_SECONDS.
 */
const watchConnection = (
  get: () => CallStoreState,
  set: (fn: (s: CallStoreState) => Partial<CallStoreState>) => void
) => {
  callService.setConnectionStateListener((state) => {
    set(() => ({ connectionState: state }));
    const current = get().currentCall;
    if (!current) return;

    if (state === 'disconnected' || state === 'failed') {
      const isCaller = current.participant_id === current.caller_id;
      if (isCaller && !iceRestartTimer) {
        iceRestartTimer = setTimeout(async () => {
          iceRestartTimer = null;
          const now = get().currentCall;
          const conn = callService.getConnectionState();
          if (!now || (conn !== 'disconnected' && conn !== 'failed')) return;
          logger.info('Connection dropped – restarting ICE');
          const offer = await callService.restartIce();
          if (offer) {
            await callService.sendSignal(now.receiver_id, {
              type: 'offer', callType: now.call_type, sdp: offer, callerId: now.caller_id, restart: true,
            });
          }
        }, state === 'failed' ? 0 : ICE_RESTART_DELAY_MS);
      }

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          const curr = get().currentCall;
          const conn = get().connectionState;
          if (curr && (conn === 'disconnected' || conn === 'failed')) {
            logger.warn('Reconnection timed out – terminating call');
            callSounds.ended();
            clearAllTimers();
            const partnerId = curr.participant_id === curr.caller_id ? curr.receiver_id : curr.caller_id;
            void callService.sendSignal(partnerId, { type: 'end-call', senderId: curr.participant_id });
            logCallMessage(curr.call_type === 'video' ? 'Video call ended (Connection lost)' : 'Voice call ended (Connection lost)');
            addCallHistory(get, set, 'completed');
            callService.endCall();
            set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null, ...NO_ROUTES }));
          }
        }, RECONNECT_TIMEOUT_SECONDS * 1000);
      }
    } else if (state === 'connected') {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (iceRestartTimer) { clearTimeout(iceRestartTimer); iceRestartTimer = null; }
    }
  });
};

export const useCallStore = create<CallStoreState>((set, get) => ({
  currentCall: null,
  localStream: null,
  remoteStream: null,
  callSeconds: 0,
  facingMode: 'user',
  isMuted: false,
  isVideoOff: false,
  audioRoutes: [],
  audioRouteId: null,
  connectionState: null,
  permissionError: null,
  callHistory: [],

  startCall: async (callerId, receiverId, callType) => {
    // Guard: already in a call
    if (get().currentCall) return;

    let stream: MediaStream;
    try {
      stream = await callService.getLocalMedia(callType);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? callType === 'video'
          ? 'Camera or microphone permission denied. Please allow access in your browser settings and try again.'
          : 'Microphone permission denied. Please allow microphone access in your browser settings and try again.'
        : callType === 'video'
          ? 'Could not access camera or microphone. Please check your device settings.'
          : 'Could not access microphone. Please check your device settings.';
      set(() => ({ permissionError: msg }));
      return;
    }

    const newSession: CallSession = {
      id: `call_${Date.now()}`,
      caller_id: callerId,
      receiver_id: receiverId,
      participant_id: callerId,
      call_type: callType,
      state: 'outgoing',
    };

    set(() => ({
      currentCall: newSession,
      localStream: stream,
      isMuted: false,
      isVideoOff: false,
      callSeconds: 0,
      connectionState: null,
      permissionError: null,
    }));

    callSounds.ringback();
    startAudioRouting(get);

    watchConnection(get, set as any);
    await callService.loadIceServers();

    callService.createPeerConnection(
      (remoteStr) => set(() => ({ remoteStream: remoteStr })),
      (candidate) => {
        callService.sendSignal(receiverId, {
          type: 'ice-candidate',
          candidate: candidate.toJSON(),
          senderId: callerId,
        });
      }
    );

    const offer = await callService.createOffer(callType === 'video');
    await callService.sendSignal(receiverId, {
      type: 'offer',
      callType,
      sdp: offer,
      callerId,
    });
    void pushService.notifyPartner('call');

    // Auto-timeout if unanswered
    callTimeoutTimer = setTimeout(() => {
      const current = get().currentCall;
      if (current?.state === 'outgoing') {
        logger.info('Call timed out – no answer');
        callSounds.ended();
        callService.sendSignal(receiverId, { type: 'end-call', senderId: callerId });
        logCallMessage(current.call_type === 'video' ? 'Missed video call' : 'Missed voice call');
        addCallHistory(get, set as any, 'missed');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, ...NO_ROUTES }));
      }
    }, CALL_TIMEOUT_SECONDS * 1000);
  },

  receiveCallOffer: (callerId, receiverId, callType, offer) => {
    const existing = get().currentCall;
    if (existing && (existing.state === 'connected' || existing.state === 'outgoing')) {
      // Really in a call (or calling) — respond with busy
      callService.sendSignal(callerId, { type: 'busy', senderId: receiverId });
      return;
    }
    if (existing) {
      // Still ringing for an older call that was handled elsewhere: replace it
      stopRingtone();
      clearAllTimers();
      callService.endCall();
    }

    const newSession: CallSession = {
      id: `call_${Date.now()}`,
      caller_id: callerId,
      receiver_id: receiverId,
      participant_id: receiverId,
      call_type: callType,
      state: 'incoming',
    };

    callService.resetPendingCandidates();
    void callService.loadIceServers();
    set(() => ({ currentCall: newSession, callSeconds: 0, permissionError: null }));
    callSounds.ringtone();

    // Trigger system notification if app is hidden
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try {
        new Notification(callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call', {
          body: `Your partner is ${callType === 'video' ? 'video ' : ''}calling you on Ivy`,
          icon: '/pwa-192x192.png',
        });
      } catch {}
    }

    // Stash offer for acceptCall
    (window as any).__pendingCallOffer = offer;

    // Fallback: stop ringing if the caller's "missed call" signal never arrives.
    // The caller posts the missed-call note, so nothing is logged here.
    callTimeoutTimer = setTimeout(() => {
      const current = get().currentCall;
      if (current?.state === 'incoming') {
        stopRingtone();
        addCallHistory(get, set as any, 'missed');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, ...NO_ROUTES }));
      }
    }, RINGING_FALLBACK_SECONDS * 1000);
  },

  acceptCall: async () => {
    stopRingtone();
    clearAllTimers();
    const current = get().currentCall;
    if (!current) return;

    let stream: MediaStream;
    try {
      stream = await callService.getLocalMedia(current.call_type);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? current.call_type === 'video'
          ? 'Camera or microphone permission denied. Please allow access and try again.'
          : 'Microphone permission denied. Please allow microphone access and try again.'
        : current.call_type === 'video'
          ? 'Could not access camera or microphone. Please check your device settings.'
          : 'Could not access microphone. Please check your device settings.';
      set(() => ({ permissionError: msg }));
      return;
    }

    watchConnection(get, set as any);
    await callService.loadIceServers();

    callService.createPeerConnection(
      (remoteStr) => set(() => ({ remoteStream: remoteStr })),
      (candidate) => {
        callService.sendSignal(current.caller_id, {
          type: 'ice-candidate',
          candidate: candidate.toJSON(),
          senderId: current.receiver_id,
        });
      }
    );

    // Stop the ringing on my other devices (broadcasts never echo back to this one)
    void callService.sendSignal(current.receiver_id, { type: 'answered-elsewhere', senderId: current.receiver_id });

    const pendingOffer = (window as any).__pendingCallOffer;
    if (pendingOffer) {
      const answer = await callService.handleOfferAndCreateAnswer(pendingOffer);
      await callService.sendSignal(current.caller_id, {
        type: 'answer',
        sdp: answer,
        receiverId: current.receiver_id,
      });
      delete (window as any).__pendingCallOffer;
    }

    set(() => ({
      localStream: stream,
      currentCall: { ...current, state: 'connected', started_at: new Date().toISOString() },
    }));

    startCallTimer(set as any);
    startAudioRouting(get);
  },

  rejectCall: () => {
    stopRingtone();
    clearAllTimers();
    const current = get().currentCall;
    if (current) {
      callService.sendSignal(current.caller_id, { type: 'reject-call', senderId: current.receiver_id });
      void callService.sendSignal(current.receiver_id, { type: 'answered-elsewhere', senderId: current.receiver_id });
      logCallMessage(current.call_type === 'video' ? 'Declined video call' : 'Declined voice call');
      addCallHistory(get, set as any, 'rejected');
    }
    callService.endCall();
    set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, ...NO_ROUTES }));
  },

  endCall: () => {
    if (get().currentCall) callSounds.ended();
    clearAllTimers();
    const current = get().currentCall;
    const seconds = get().callSeconds;

    if (current) {
      const partnerId = current.participant_id === current.caller_id ? current.receiver_id : current.caller_id;
      callService.sendSignal(partnerId, { type: 'end-call', senderId: current.participant_id });

      if (current.state === 'connected') {
        const callTypeLabel = current.call_type === 'video' ? 'Video' : 'Voice';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const durationStr = seconds > 0 ? `${mins}m ${secs}s` : '< 1s';
        logCallMessage(`${callTypeLabel} call ended (${durationStr})`);
        addCallHistory(get, set as any, 'completed');
      }
    }

    callService.endCall();
    set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null, ...NO_ROUTES }));
  },

  toggleMute: () => {
    const nextMute = !get().isMuted;
    callService.toggleMicrophone(!nextMute);
    set(() => ({ isMuted: nextMute }));
  },

  toggleVideo: () => {
    const nextVideoOff = !get().isVideoOff;
    callService.toggleCamera(!nextVideoOff);
    set(() => ({ isVideoOff: nextVideoOff }));
  },

  toggleSpeaker: () => {
    const { audioRoutes, audioRouteId } = get();
    const active = audioRoutes.find((r) => r.id === audioRouteId);
    const target = active?.kind === 'speaker'
      ? audioRoutes.find((r) => r.kind === 'earpiece') ?? audioRoutes.find((r) => r.kind !== 'speaker')
      : audioRoutes.find((r) => r.kind === 'speaker');
    if (target) void get().setAudioRoute(target.id);
  },

  setAudioRoute: async (id) => {
    const route = get().audioRoutes.find((r) => r.id === id);
    if (!route) return;
    const previous = get().audioRouteId;
    set(() => ({ audioRouteId: id }));
    try {
      if (route.via === 'output') {
        await setOutputDevice(id);
      } else {
        const stream = await callService.switchMicrophone(id);
        if (stream) set(() => ({ localStream: stream }));
      }
    } catch (err) {
      logger.warn('Unable to switch audio route:', err);
      set(() => ({ audioRouteId: previous }));
    }
  },

  refreshAudioRoutes: async () => {
    const routes = await listAudioRoutes();
    const current = get().currentCall;
    if (!current) return;
    const before = get().audioRoutes;
    const activeId = get().audioRouteId;
    set(() => ({ audioRoutes: routes }));

    const isNew = (r: AudioRoute) => !before.some((b) => b.id === r.id);
    const plugged = routes.find((r) => (r.kind === 'bluetooth' || r.kind === 'headset') && isNew(r));
    if (!activeId || !routes.some((r) => r.id === activeId)) {
      // First pick, or the device in use went away (e.g. Bluetooth turned off)
      const pick = preferredRoute(routes, current.call_type === 'video');
      if (pick) await get().setAudioRoute(pick.id);
      else set(() => ({ audioRouteId: null }));
    } else if (plugged && before.length > 0) {
      // Earbuds connected mid-call: move the call to them, like a phone does
      await get().setAudioRoute(plugged.id);
    }
  },

  switchCamera: async () => {
    const current = get().currentCall;
    if (!current || current.call_type !== 'video') return;
    const nextFacing = get().facingMode === 'user' ? 'environment' : 'user';
    try {
      const stream = await callService.getLocalMedia('video', nextFacing);
      await callService.replaceLocalStream(stream);
      set(() => ({ facingMode: nextFacing, localStream: stream }));
    } catch (error) {
      logger.warn('Unable to switch camera:', error);
    }
  },

  listenToSignaling: (userId: string) => {
    return callService.initSignaling(userId, async (event: SignalingEvent) => {
      const current = get().currentCall;

      if (event.type === 'offer') {
        if (event.restart) {
          if (current && current.caller_id === event.callerId && current.state === 'connected') {
            const answer = await callService.handleOfferAndCreateAnswer(event.sdp);
            await callService.sendSignal(event.callerId, { type: 'answer', sdp: answer, receiverId: userId });
          }
          return;
        }
        get().receiveCallOffer(event.callerId, userId, event.callType, event.sdp);
      } else if (event.type === 'answer' && current?.state === 'connected') {
        await callService.handleAnswer(event.sdp);
      } else if (event.type === 'answer' && current) {
        stopRingtone();
        clearAllTimers();
        await callService.handleAnswer(event.sdp);
        set(() => ({ currentCall: { ...current, state: 'connected', started_at: new Date().toISOString() } }));
        startCallTimer(set as any);
      } else if (event.type === 'answered-elsewhere') {
        if (current?.state === 'incoming') {
          stopRingtone();
          clearAllTimers();
          callService.endCall();
          set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, ...NO_ROUTES }));
        }
      } else if (event.type === 'ice-candidate') {
        await callService.addIceCandidate(event.candidate);
      } else if (event.type === 'busy') {
        callSounds.busy();
        clearAllTimers();
        logCallMessage(`${current?.call_type === 'video' ? 'Video' : 'Voice'} call – User busy`);
        addCallHistory(get, set as any, 'busy');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, ...NO_ROUTES }));
      } else if (event.type === 'end-call' || event.type === 'reject-call') {
        if (current && current.state !== 'incoming') callSounds.ended();
        else stopRingtone();
        clearAllTimers();

        addCallHistory(get, set as any, event.type === 'reject-call' ? 'rejected' : 'completed');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null, ...NO_ROUTES }));
      }
    });
  },

  recoverAfterResume: () => {
    callService.recoverSignaling();
    const current = get().currentCall;
    const connectionState = callService.getConnectionState();
    if (current && (connectionState === 'closed' || connectionState === 'failed')) {
      stopRingtone();
      clearAllTimers();
      callService.endCall();
      set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null, ...NO_ROUTES }));
    }
  },

  clearPermissionError: () => set(() => ({ permissionError: null })),

  loadCallHistory: async () => {
    try {
      const records = await ivyDb.callLogs.orderBy('created_at').reverse().limit(100).toArray();
      set(() => ({ callHistory: records }));
    } catch (e) {
      logger.warn('Failed to load call logs from IndexedDB:', e);
    }
  },
}));

// Stop following audio devices once a call is over
useCallStore.subscribe((state, prev) => {
  if (prev.currentCall && !state.currentCall) stopAudioRouting();
});
