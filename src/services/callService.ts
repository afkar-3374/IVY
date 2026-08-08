import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import type { CallType } from '../types';

export type SignalingEvent =
  | { type: 'offer'; callType: CallType; sdp: RTCSessionDescriptionInit; callerId: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; receiverId: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; senderId: string }
  | { type: 'end-call'; senderId: string }
  | { type: 'reject-call'; senderId: string }
  | { type: 'busy'; senderId: string };

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onSignalingEventCallback: ((event: SignalingEvent) => void) | null = null;
  private onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  setConnectionStateListener(fn: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChange = fn;
  }

  initSignaling(userId: string, onEvent: (event: SignalingEvent) => void): () => void {
    this.onSignalingEventCallback = onEvent;

    if (!supabase) return () => {};

    const channelName = 'ivy_call_signaling';
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (!payload || (payload as { targetUserId?: string }).targetUserId !== userId) return;
        logger.info('Received call signal:', payload?.type);
        if (this.onSignalingEventCallback) {
          const { targetUserId: _targetUserId, ...event } = payload as SignalingEvent & { targetUserId: string };
          this.onSignalingEventCallback(event);
        }
      })
      .subscribe();

    return () => {
      if (supabase && this.channel) {
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }

  async sendSignal(targetUserId: string, payload: SignalingEvent): Promise<void> {
    if (!supabase) {
      logger.warn('Supabase not available – signaling skipped');
      return;
    }
    try {
      if (!this.channel) throw new Error('Call signaling is not initialized');
      const result = await this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { ...payload, targetUserId },
      });
      if (result !== 'ok') throw new Error(`Signal delivery failed: ${result}`);
    } catch (err) {
      logger.error('Error sending call signal:', err);
    }
  }

  async getLocalMedia(callType: CallType, facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream> {
    // Stop any existing tracks first
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video' ? { facingMode } : false,
    };

    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  createPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): RTCPeerConnection {
    // Clean up existing peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.pendingIceCandidates = [];

    this.onRemoteStreamCallback = onRemoteStream;
    this.remoteStream = new MediaStream();
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
      if (this.onRemoteStreamCallback && this.remoteStream) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      logger.info('WebRTC connection state changed:', state);
      if (state && this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      logger.info('ICE connection state:', this.peerConnection?.iceConnectionState);
    };

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    return this.peerConnection;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not created');
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleOfferAndCreateAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not created');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingIceCandidates();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushPendingIceCandidates();
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection?.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        logger.warn('Error adding ICE candidate:', e);
      }
    } else {
      this.pendingIceCandidates.push(candidate);
    }
  }

  private async flushPendingIceCandidates(): Promise<void> {
    const candidates = this.pendingIceCandidates.splice(0);
    for (const candidate of candidates) await this.addIceCandidate(candidate);
  }

  toggleMicrophone(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleCamera(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  async restartIce(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (err) {
      logger.error('Failed to restart ICE:', err);
      return null;
    }
  }

  async checkMicrophonePermission(): Promise<PermissionState | 'unknown'> {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return res.state;
      } catch {
        return 'unknown';
      }
    }
    return 'unknown';
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState ?? null;
  }

  endCall(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    this.remoteStream?.getTracks().forEach((t) => t.stop());
    this.remoteStream = null;

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingIceCandidates = [];
    logger.info('Call ended – peer connection closed');
  }
}

export const callService = new CallService();
