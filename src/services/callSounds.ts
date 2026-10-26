/**
 * Call sounds, made with Web Audio so they work offline and need no files:
 *   ringtone  – the receiver's phone rings (with vibration)
 *   ringback  – the caller hears "tring-tring … tring-tring" while it rings
 *   busy      – short beeps when the partner is busy
 *   ended     – two soft beeps when a call ends
 */

type Loop = { stop: () => void };

let ctx: AudioContext | null = null;
let current: Loop | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only allow sound after a tap: wake the audio engine on the first one,
// so an incoming call can ring later even if nobody touched the call screen.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ac = audioContext();
    if (ac?.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    }
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** One tone (a mix of frequencies) from `start` for `length` seconds, with soft edges. */
function tone(ac: AudioContext, out: AudioNode, freqs: number[], start: number, length: number, volume: number, type: OscillatorType = 'sine') {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.setValueAtTime(volume, start + length - 0.03);
  gain.gain.linearRampToValueAtTime(0, start + length);
  gain.connect(out);
  for (const f of freqs) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }
}

/** A plucked note that fades out, for the ringtone melody. */
function pluck(ac: AudioContext, out: AudioNode, freq: number, start: number, volume: number) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
  gain.connect(out);
  for (const [mult, type] of [[1, 'sine'], [2, 'triangle']] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq * mult;
    const g = ac.createGain();
    g.gain.value = mult === 1 ? 1 : 0.25;
    osc.connect(g).connect(gain);
    osc.start(start);
    osc.stop(start + 0.5);
  }
}

/** Repeat `schedule(at)` every `period` seconds until stopped. */
function loop(period: number, schedule: (ac: AudioContext, out: AudioNode, at: number) => void, vibrate?: number[]): Loop {
  const ac = audioContext();
  const master = ac?.createGain();
  if (ac && master) master.connect(ac.destination);

  let next = ac ? ac.currentTime + 0.05 : 0;
  const tick = () => {
    if (ac && master) {
      // Keep about one period scheduled ahead
      while (next < ac.currentTime + period) {
        schedule(ac, master, next);
        next += period;
      }
    }
  };
  const buzz = () => {
    if (vibrate && 'vibrate' in navigator) navigator.vibrate(vibrate);
  };
  tick();
  buzz();
  const timer = setInterval(tick, (period * 1000) / 2);
  const buzzTimer = setInterval(buzz, period * 1000);

  return {
    stop: () => {
      clearInterval(timer);
      clearInterval(buzzTimer);
      if (vibrate && 'vibrate' in navigator) navigator.vibrate(0);
      if (ac && master) {
        master.gain.setValueAtTime(master.gain.value, ac.currentTime);
        master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.05);
        setTimeout(() => master.disconnect(), 100);
      }
    },
  };
}

function play(next: Loop | null) {
  current?.stop();
  current = next;
}

// Ringtone melody: a gentle rising arpeggio, played twice, then a pause
const RING_NOTES = [659.25, 830.61, 987.77, 1318.5, 987.77, 830.61]; // E5 G#5 B5 E6 B5 G#5

export const callSounds = {
  /** Incoming call: ringtone + vibration until stopped. */
  ringtone(): void {
    play(
      loop(
        3.2,
        (ac, out, at) => {
          for (let rep = 0; rep < 2; rep++) {
            RING_NOTES.forEach((f, i) => pluck(ac, out, f, at + rep * 1.0 + i * 0.14, 0.32));
          }
        },
        [800, 400, 800]
      )
    );
  },

  /** Outgoing call: the familiar double ring (400 + 450 Hz, 0.4s on, 0.2s off, 0.4s on, 2s off). */
  ringback(): void {
    play(
      loop(3, (ac, out, at) => {
        tone(ac, out, [400, 450], at, 0.4, 0.12);
        tone(ac, out, [400, 450], at + 0.6, 0.4, 0.12);
      })
    );
  },

  /** Partner busy: 425 Hz, 0.375s on/off, about 3 seconds. */
  busy(): void {
    const ac = audioContext();
    play(null);
    if (!ac) return;
    for (let i = 0; i < 4; i++) tone(ac, ac.destination, [425], ac.currentTime + 0.05 + i * 0.75, 0.375, 0.12);
  },

  /** Call ended or declined: two soft descending beeps. */
  ended(): void {
    const ac = audioContext();
    play(null);
    if (!ac) return;
    tone(ac, ac.destination, [620], ac.currentTime + 0.05, 0.18, 0.1);
    tone(ac, ac.destination, [480], ac.currentTime + 0.3, 0.25, 0.1);
  },

  stop(): void {
    play(null);
  },
};
