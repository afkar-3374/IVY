import { create } from 'zustand';
import type { CallSession, CallType, CallHistoryRecord } from '../types';
import { callService, type SignalingEvent } from '../services/callService';
import { chatService } from '../services/chatService';
import { logger } from '../services/logger/logger';
import { ivyDb } from '../db/ivyDb';

const CALL_TIMEOUT_SECONDS = 45; // Unanswered call timeout
const RECONNECT_TIMEOUT_SECONDS = 15; // Connection loss timeout

interface CallStoreState {
  currentCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callSeconds: number;
  facingMode: 'user' | 'environment';
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
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
  toggleSpeaker: () => void;
  switchCamera: () => Promise<void>;
  listenToSignaling: (userId: string) => () => void;
  recoverAfterResume: () => void;
  clearPermissionError: () => void;
  loadCallHistory: () => Promise<void>;
}

let callTimerInterval: NodeJS.Timeout | null = null;
let callTimeoutTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let ringtoneAudio: HTMLAudioElement | null = null;

const playRingtone = () => {
  try {
    if (!ringtoneAudio) {
      ringtoneAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      ringtoneAudio.loop = true;
    }
    ringtoneAudio.play().catch(() => {});
  } catch {}
};

const stopRingtone = () => {
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
  }
};

const clearAllTimers = () => {
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

export const useCallStore = create<CallStoreState>((set, get) => ({
  currentCall: null,
  localStream: null,
  remoteStream: null,
  callSeconds: 0,
  facingMode: 'user',
  isMuted: false,
  isVideoOff: false,
  isSpeakerOn: true,
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

    playRingtone();

    callService.setConnectionStateListener((state) => {
      set(() => ({ connectionState: state }));
      if (state === 'disconnected' || state === 'failed') {
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            const current = get().currentCall;
            if (current && (get().connectionState === 'disconnected' || get().connectionState === 'failed')) {
              logger.warn('Reconnection timed out – terminating call');
              stopRingtone();
              clearAllTimers();
              chatService.sendMessage({
                sender_id: current.caller_id,
                receiver_id: current.receiver_id,
                content: 'Voice call ended (Connection lost)',
                message_type: 'system',
              });
              addCallHistory(get, set as any, 'completed');
              callService.endCall();
              set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null }));
            }
          }, RECONNECT_TIMEOUT_SECONDS * 1000);
        }
      } else if (state === 'connected') {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      }
    });

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

    // Auto-timeout if unanswered
    callTimeoutTimer = setTimeout(() => {
      const current = get().currentCall;
      if (current?.state === 'outgoing') {
        logger.info('Call timed out – no answer');
        stopRingtone();
        callService.sendSignal(receiverId, { type: 'end-call', senderId: callerId });
        chatService.sendMessage({
          sender_id: callerId,
          receiver_id: receiverId,
          content: current.call_type === 'video' ? 'Missed video call' : 'Missed voice call',
          message_type: 'system',
        });
        addCallHistory(get, set as any, 'missed');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0 }));
      }
    }, CALL_TIMEOUT_SECONDS * 1000);
  },

  receiveCallOffer: (callerId, receiverId, callType, offer) => {
    if (get().currentCall) {
      // Already in a call — respond with busy
      callService.sendSignal(callerId, { type: 'busy', senderId: receiverId });
      return;
    }

    const newSession: CallSession = {
      id: `call_${Date.now()}`,
      caller_id: callerId,
      receiver_id: receiverId,
      participant_id: receiverId,
      call_type: callType,
      state: 'incoming',
    };

    set(() => ({ currentCall: newSession, callSeconds: 0, permissionError: null }));
    playRingtone();

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

    // Auto-timeout if not answered
    callTimeoutTimer = setTimeout(() => {
      const current = get().currentCall;
      if (current?.state === 'incoming') {
        stopRingtone();
        callService.sendSignal(callerId, { type: 'reject-call', senderId: receiverId });
        chatService.sendMessage({
          sender_id: callerId,
          receiver_id: receiverId,
          content: current.call_type === 'video' ? 'Missed video call' : 'Missed voice call',
          message_type: 'system',
        });
        addCallHistory(get, set as any, 'missed');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0 }));
      }
    }, CALL_TIMEOUT_SECONDS * 1000);
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

    callService.setConnectionStateListener((state) => {
      set(() => ({ connectionState: state }));
      if (state === 'disconnected' || state === 'failed') {
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            const curr = get().currentCall;
            if (curr && (get().connectionState === 'disconnected' || get().connectionState === 'failed')) {
              logger.warn('Reconnection timed out – terminating call');
              stopRingtone();
              clearAllTimers();
              chatService.sendMessage({
                sender_id: curr.caller_id,
                receiver_id: curr.receiver_id,
                content: curr.call_type === 'video' ? 'Video call ended (Connection lost)' : 'Voice call ended (Connection lost)',
                message_type: 'system',
              });
              addCallHistory(get, set as any, 'completed');
              callService.endCall();
              set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null }));
            }
          }, RECONNECT_TIMEOUT_SECONDS * 1000);
        }
      } else if (state === 'connected') {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      }
    });

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
  },

  rejectCall: () => {
    stopRingtone();
    clearAllTimers();
    const current = get().currentCall;
    if (current) {
      callService.sendSignal(current.caller_id, { type: 'reject-call', senderId: current.receiver_id });
      chatService.sendMessage({
        sender_id: current.participant_id,
        receiver_id: current.caller_id,
        content: current.call_type === 'video' ? 'Declined video call' : 'Declined voice call',
        message_type: 'system',
      });
      addCallHistory(get, set as any, 'rejected');
    }
    callService.endCall();
    set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0 }));
  },

  endCall: () => {
    stopRingtone();
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
        chatService.sendMessage({
          sender_id: current.participant_id,
          receiver_id: partnerId,
          content: `${callTypeLabel} call ended (${durationStr})`,
          message_type: 'system',
        });
        addCallHistory(get, set as any, 'completed');
      }
    }

    callService.endCall();
    set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null }));
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
    const nextSpeaker = !get().isSpeakerOn;
    set(() => ({ isSpeakerOn: nextSpeaker }));
    // Note: Speaker API (setSinkId) is not universally supported; handle gracefully
    try {
      const remoteAudio = document.querySelector<HTMLAudioElement>('#ivy-remote-audio');
      if (remoteAudio && 'setSinkId' in remoteAudio) {
        (remoteAudio as any).setSinkId(nextSpeaker ? 'default' : 'communications');
      }
    } catch {}
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
        get().receiveCallOffer(event.callerId, userId, event.callType, event.sdp);
      } else if (event.type === 'answer' && current) {
        stopRingtone();
        clearAllTimers();
        await callService.handleAnswer(event.sdp);
        set(() => ({ currentCall: { ...current, state: 'connected', started_at: new Date().toISOString() } }));
        startCallTimer(set as any);
      } else if (event.type === 'ice-candidate') {
        await callService.addIceCandidate(event.candidate);
      } else if (event.type === 'busy') {
        stopRingtone();
        clearAllTimers();
        chatService.sendMessage({
          sender_id: current?.caller_id || userId,
          receiver_id: current?.receiver_id || userId,
          content: `${current?.call_type === 'video' ? 'Video' : 'Voice'} call – User busy`,
          message_type: 'system',
        });
        addCallHistory(get, set as any, 'busy');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0 }));
      } else if (event.type === 'end-call' || event.type === 'reject-call') {
        stopRingtone();
        clearAllTimers();

        if (event.type === 'reject-call' && current) {
          chatService.sendMessage({
            sender_id: current.caller_id,
            receiver_id: current.receiver_id,
            content: current.call_type === 'video' ? 'Declined video call' : 'Declined voice call',
            message_type: 'system',
          });
        }

        addCallHistory(get, set as any, event.type === 'reject-call' ? 'rejected' : 'completed');
        callService.endCall();
        set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null }));
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
      set(() => ({ currentCall: null, localStream: null, remoteStream: null, callSeconds: 0, connectionState: null }));
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
