import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bluetooth, Check, ChevronUp, Headphones, Smartphone, Volume2 } from 'lucide-react';
import { useCallStore } from '../../store/useCallStore';
import type { AudioRoute, AudioRouteKind } from '../../services/audioRoutes';

const ICONS: Record<AudioRouteKind, React.ReactNode> = {
  earpiece: <Smartphone />,
  speaker: <Volume2 />,
  bluetooth: <Bluetooth />,
  headset: <Headphones />,
};

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  /** Renders the round call button (the screen's own CallBtn). */
  renderButton: (props: { onClick: () => void; icon: React.ReactNode; label: string; active: boolean }) => React.ReactNode;
}

/**
 * The audio button of the call screen, like a phone app:
 *  - only phone + speaker: tapping switches between them
 *  - Bluetooth or a headset connected: tapping opens a list to pick from
 */
export const AudioRouteControl: React.FC<Props> = ({ renderButton }) => {
  const routes = useCallStore((s) => s.audioRoutes);
  const activeId = useCallStore((s) => s.audioRouteId);
  const setAudioRoute = useCallStore((s) => s.setAudioRoute);
  const toggleSpeaker = useCallStore((s) => s.toggleSpeaker);
  const [open, setOpen] = useState(false);

  const active = routes.find((r) => r.id === activeId) ?? null;
  const hasExtra = routes.some((r) => r.kind === 'bluetooth' || r.kind === 'headset');
  const simpleToggle = !hasExtra && routes.some((r) => r.kind === 'speaker') && routes.length === 2;

  let button: React.ReactNode;
  if (simpleToggle) {
    const onSpeaker = active?.kind === 'speaker';
    button = renderButton({ onClick: toggleSpeaker, icon: <Volume2 />, label: 'Speaker', active: onSpeaker });
  } else {
    button = renderButton({
      onClick: () => setOpen(true),
      // The little arrow says this opens a list, like the phone app's audio button
      icon: (
        <span className="relative block w-full h-full [&>svg]:w-full [&>svg]:h-full">
          {active ? ICONS[active.kind] : <Volume2 />}
          <ChevronUp className="!w-3 !h-3 absolute -right-2.5 -top-2 opacity-80" strokeWidth={3} />
        </span>
      ),
      label: active ? shortLabel(active) : 'Audio',
      active: !!active && active.kind !== 'earpiece',
    });
  }

  return (
    <>
      {button}
      <AnimatePresence>
        {open && (
          <motion.div
            key="audio-route-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-sm mx-3 mb-[calc(env(safe-area-inset-bottom)+12px)] rounded-3xl bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Choose audio output"
            >
              <p className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Audio output</p>
              {routes.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-white/70 leading-relaxed">
                  {isIOS
                    ? 'Your iPhone chooses where the sound plays. To switch to AirPods or the speaker, open Control Center and tap the AirPlay icon on the audio card.'
                    : 'This browser chooses where the sound plays. Use your phone’s volume or Bluetooth controls to switch.'}
                </p>
              ) : (
                <ul>
                  {routes.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          void setAudioRoute(r.id);
                          setOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left text-white active:bg-white/10 hover:bg-white/5 transition-colors"
                      >
                        <span className="w-5 h-5 text-white/80 [&>svg]:w-5 [&>svg]:h-5">{ICONS[r.kind]}</span>
                        <span className="flex-1 text-[15px] font-semibold truncate">{r.label}</span>
                        {r.id === activeId && <Check className="w-5 h-5 text-emerald-400" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full mt-1 py-3 rounded-2xl text-[15px] font-bold text-white/70 bg-white/5 active:bg-white/10"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

function shortLabel(route: AudioRoute): string {
  if (route.via === 'input') return route.label;
  return route.label.length > 12 ? `${route.label.slice(0, 11)}…` : route.label;
}
