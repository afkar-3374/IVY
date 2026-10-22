import React, { useEffect, useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { pushService } from '../../services/pushService';
import { notifyKeyStore } from '../../services/notifyKeyStore';
import { Switch } from '../ui/Switch';
import { useUIStore } from '../../store/useUIStore';
import { cardClass } from './CoupleCards';

type State = 'loading' | 'off' | 'on' | 'unsupported' | 'install' | 'denied';

function useNotificationState(): [State, () => Promise<void>, () => Promise<void>] {
  const [state, setState] = useState<State>('loading');
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    void (async () => {
      if (pushService.needsInstall()) return setState('install');
      if (!pushService.isSupported()) return setState('unsupported');
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return setState('denied');
      setState((await pushService.isEnabled()) ? 'on' : 'off');
    })();
  }, []);

  const enable = async () => {
    const result = await pushService.enable();
    if (result === 'enabled') {
      setState('on');
      addToast('Notifications on — even when Ivy is closed 🔔', 'success');
    } else if (result === 'denied') {
      setState('denied');
    } else {
      addToast('Could not turn on notifications', 'error');
    }
  };

  const disable = async () => {
    await pushService.disable();
    setState('off');
  };

  return [state, enable, disable];
}

const HELP: Partial<Record<State, string>> = {
  install: 'On iPhone, tap Share → "Add to Home Screen", then open Ivy from there to allow notifications.',
  denied: 'Notifications are blocked for Ivy. Allow them in your browser or phone settings, then come back.',
  unsupported: "This browser can't receive notifications when Ivy is closed.",
};

/** Card on the Us page until this device gets notifications. */
export const PushPrompt: React.FC = () => {
  const [state, enable] = useNotificationState();
  if (state === 'loading' || state === 'on' || state === 'unsupported') return null;

  return (
    <div className={`${cardClass} p-5 flex items-start gap-4`}>
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-300 to-[#E05A74] text-white flex items-center justify-center flex-shrink-0 shadow-soft">
        <BellRing className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-800 dark:text-stone-100">Never miss each other</p>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          {HELP[state] || 'Get messages, calls and love taps even when Ivy is closed — just like WhatsApp.'}
        </p>
        {state === 'off' && (
          <button onClick={enable} className="btn-gloss mt-3 rounded-full px-4 py-2 text-sm font-semibold">
            Turn on notifications
          </button>
        )}
      </div>
    </div>
  );
};

/** Row for Settings → Notifications. */
export const PushSetting: React.FC = () => {
  const [state, enable, disable] = useNotificationState();
  const [showText, setShowText] = useState(true);

  useEffect(() => {
    void notifyKeyStore.getShowText().then(setShowText);
  }, []);

  const changeShowText = (show: boolean) => {
    setShowText(show);
    void notifyKeyStore.setShowText(show);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold">When Ivy is closed</p>
          <p className="text-[10px] text-stone-500">{HELP[state] || 'Push notifications on this device'}</p>
        </div>
        {state === 'on' ? (
          <button onClick={disable} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 px-3 py-1 text-xs font-semibold">
            <Check className="w-3.5 h-3.5" /> On
          </button>
        ) : state === 'off' ? (
          <button onClick={enable} className="btn-gloss rounded-full px-3 py-1 text-xs font-semibold">
            Turn on
          </button>
        ) : null}
      </div>
      {state === 'on' && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold">Show message text</p>
            <p className="text-[10px] text-stone-500">Off: only who wrote, not what</p>
          </div>
          <Switch checked={showText} onChange={changeShowText} />
        </div>
      )}
    </>
  );
};
