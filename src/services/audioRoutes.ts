import { logger } from './logger/logger';

/**
 * Where call audio plays: phone earpiece, loudspeaker, a Bluetooth device or a headset.
 *
 * Browsers expose this in two ways:
 *   - Android Chrome lists the phone's audio routes as microphones ("Speakerphone",
 *     "Headset earpiece", "Bluetooth headset", ...). Picking one as the microphone
 *     moves the call's sound there too, like the phone app does.
 *   - Desktop browsers list real outputs and play through one with setSinkId().
 * iPhones choose the route themselves (Control Center), so there is nothing to list.
 */

export type AudioRouteKind = 'earpiece' | 'speaker' | 'bluetooth' | 'headset';

export interface AudioRoute {
  id: string;
  kind: AudioRouteKind;
  label: string;
  /** 'input': switch by picking this microphone (Android). 'output': switch with setSinkId. */
  via: 'input' | 'output';
}

const ANDROID_ROUTES: { match: RegExp; kind: AudioRouteKind; label: string }[] = [
  { match: /^headset earpiece$/i, kind: 'earpiece', label: 'Phone' },
  { match: /^speakerphone$/i, kind: 'speaker', label: 'Speaker' },
  { match: /^bluetooth headset$/i, kind: 'bluetooth', label: 'Bluetooth' },
  { match: /^wired headset$/i, kind: 'headset', label: 'Headphones' },
  { match: /^usb audio$/i, kind: 'headset', label: 'USB headset' },
];

const ORDER: AudioRouteKind[] = ['earpiece', 'speaker', 'bluetooth', 'headset'];

function classifyOutput(label: string): AudioRouteKind {
  if (/bluetooth|airpods|buds|hands-?free|\bbt\b/i.test(label)) return 'bluetooth';
  if (/headphone|headset|earphone|usb/i.test(label)) return 'headset';
  if (/earpiece|receiver|handset/i.test(label)) return 'earpiece';
  return 'speaker';
}

/** Strip "Default - " and "(1a2b:3c4d)" noise from desktop device names. */
function cleanLabel(label: string): string {
  return label.replace(/^(default|communications)\s*-\s*/i, '').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
}

export function canSetSink(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

/** Routes available right now. Labels only show once microphone permission is granted. */
export async function listAudioRoutes(): Promise<AudioRoute[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  let devices: MediaDeviceInfo[];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch (err) {
    logger.warn('Unable to list audio devices:', err);
    return [];
  }

  const android: AudioRoute[] = [];
  for (const d of devices) {
    if (d.kind !== 'audioinput') continue;
    const known = ANDROID_ROUTES.find((r) => r.match.test(d.label.trim()));
    if (known && !android.some((r) => r.kind === known.kind && r.label === known.label)) {
      android.push({ id: d.deviceId, kind: known.kind, label: known.label, via: 'input' });
    }
  }
  if (android.length > 1) return sortRoutes(android);

  if (!canSetSink()) return [];
  const outputs: AudioRoute[] = [];
  for (const d of devices) {
    if (d.kind !== 'audiooutput' || d.deviceId === 'communications' || !d.label) continue;
    const label = cleanLabel(d.label);
    // "default" duplicates one of the real devices; keep it only if it is the only one
    if (d.deviceId === 'default' && devices.some((o) => o.kind === 'audiooutput' && o.deviceId !== 'default' && o.deviceId !== 'communications' && cleanLabel(o.label) === label)) continue;
    outputs.push({ id: d.deviceId, kind: classifyOutput(label), label, via: 'output' });
  }
  return outputs.length > 1 ? sortRoutes(outputs) : [];
}

function sortRoutes(routes: AudioRoute[]): AudioRoute[] {
  return [...routes].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

/** What a phone would pick: a connected Bluetooth or wired headset, else earpiece for voice and speaker for video. */
export function preferredRoute(routes: AudioRoute[], isVideo: boolean): AudioRoute | null {
  const byKind = (k: AudioRouteKind) => routes.find((r) => r.kind === k);
  return (
    byKind('bluetooth') ??
    byKind('headset') ??
    (isVideo ? byKind('speaker') : byKind('earpiece') ?? byKind('speaker')) ??
    routes[0] ??
    null
  );
}

/** Play the call through an output device (desktop browsers). */
export async function setOutputDevice(id: string): Promise<void> {
  const elements = document.querySelectorAll<HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }>('[data-call-audio]');
  await Promise.all(Array.from(elements).map((el) => el.setSinkId?.(id)));
}
