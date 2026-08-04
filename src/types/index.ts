export type SyncStatus = 'Queued' | 'Sending' | 'Sent' | 'Delivered' | 'Read' | 'Failed' | 'Retrying';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'file' | 'system';

export interface UserProfile {
  id: string;
  login_id_hash: string;
  display_name: string;
  nickname: string; // Personal nickname assigned to partner
  about: string;
  avatar_url: string;
  wallpaper: string;
  theme: 'rose' | 'midnight' | 'sunset' | 'lavender';
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
}

export interface ReplyReference {
  id: string;
  sender_name: string;
  content: string;
  message_type: MessageType;
}

export interface Message {
  id: string; // Server UUID or Local UUID
  local_uuid: string;
  room_id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: MessageType;
  reply_to?: string;
  reply_to_msg?: ReplyReference;
  edited: boolean;
  edited_at?: string;
  deleted: boolean;
  deleted_at?: string;
  pinned: boolean;
  starred: boolean;
  forwarded: boolean;
  status: SyncStatus;
  reactions?: MessageReaction[];
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface PresenceState {
  profile_id: string;
  online: boolean;
  typing: boolean;
  recording_audio: boolean;
  uploading_media: boolean;
  in_call?: boolean;
  last_seen: string;
}

export type CallType = 'audio' | 'video';
export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended' | 'rejected' | 'busy';

export interface CallSession {
  id: string; // Call Room UUID
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  state: CallState;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  is_muted?: boolean;
  is_video_off?: boolean;
  is_speaker_on?: boolean;
}

export interface CallHistoryRecord {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: 'completed' | 'missed' | 'rejected' | 'busy';
  duration_seconds: number;
  created_at: string;
}

export type QueueActionType =
  | 'SEND_MESSAGE'
  | 'EDIT_MESSAGE'
  | 'DELETE_MESSAGE'
  | 'ADD_REACTION'
  | 'REMOVE_REACTION'
  | 'PIN_MESSAGE'
  | 'STAR_MESSAGE'
  | 'UPDATE_PROFILE'
  | 'MARK_READ';

export interface SyncQueueItem {
  id: string; // Action UUID
  action_type: QueueActionType;
  payload: Record<string, unknown>;
  retry_count: number;
  status: 'Queued' | 'Sending' | 'Synced' | 'Failed';
  error_message?: string;
  created_at: string;
}

export type ThemeMode = 'rose' | 'midnight' | 'sunset' | 'lavender' | 'ocean' | 'forest';

export type WallpaperPreset = 'botanical' | 'sunset' | 'starry' | 'minimal' | 'blush' | 'aurora' | 'custom';

export interface SearchFilter {
  query: string;
  tab: 'all' | 'messages' | 'media' | 'links' | 'files';
  date_range?: string;
}

