import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowBigUp, ArrowBigUpDash, ChevronDown, CornerDownLeft, Delete, Globe, Smile } from 'lucide-react';

/**
 * Ivy's own QWERTY keyboard for the chat box, used instead of the phone's keyboard.
 * Keys act on press (fast two-thumb typing), never take focus from the message box,
 * and edit at the cursor like a real keyboard.
 */

type Layer = 'abc' | '123' | 'sym';
type Shift = 'off' | 'once' | 'lock';

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row) => row.split(''));
const NUMBERS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '₹', '_', '&', '-', '+', '(', ')', '/'],
  ['*', '"', "'", ':', ';', '!', '?'],
];
const SYMBOLS = [
  ['~', '`', '|', '•', '√', 'π', '÷', '×', '¶', '∆'],
  ['£', '€', '$', '¢', '^', '°', '=', '{', '}', '\\'],
  ['%', '©', '®', '™', '✓', '[', ']'],
];
const QUICK_EMOJI = ['❤️', '😘', '🥰', '😂', '😍', '🤗', '🥺', '🌹'];

const DOUBLE_TAP_MS = 300;
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 60;
const WORD_DELETE_AFTER = 20; // repeats, then whole words go at a time
const CURSOR_STEP_PX = 14; // sliding on the space bar moves the cursor

// The start of a sentence: capitalise the next letter
const SENTENCE_START = /(^|[.!?]\s+|\n)$/;

const graphemes = (text: string): string[] => {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  return Segmenter ? Array.from(new Segmenter().segment(text), (s) => s.segment) : Array.from(text);
};

const tick = () => navigator.vibrate?.(6);

interface IvyKeyboardProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onEmoji: () => void;
  onClose: () => void;
  onUsePhoneKeyboard: () => void;
  /** Room the chat must leave free underneath (keyboard height + any gap below it) */
  onHeight: (px: number) => void;
}

export const IvyKeyboard: React.FC<IvyKeyboardProps> = ({ inputRef, value, onChange, onEmoji, onClose, onUsePhoneKeyboard, onHeight }) => {
  const [layer, setLayer] = useState<Layer>('abc');
  const [shift, setShift] = useState<Shift>('once');
  const [popup, setPopup] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const [bottom, setBottom] = useState(0);

  // Pinned to the bottom of what's on screen. Phones slide the page up to show a focused
  // box (which pushed the keyboard's last row out of view): keep the page itself still.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const before = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    const vv = window.visualViewport;
    const pin = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      setBottom(vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
    };
    pin();
    window.addEventListener('scroll', pin);
    vv?.addEventListener('resize', pin);
    vv?.addEventListener('scroll', pin);
    return () => {
      [html.style.overflow, body.style.overflow] = before;
      window.removeEventListener('scroll', pin);
      vv?.removeEventListener('resize', pin);
      vv?.removeEventListener('scroll', pin);
    };
  }, []);

  // Tell the chat how much room to leave so its message box sits right above the keys
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const report = () => onHeight(el.offsetHeight + bottom);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [bottom, onHeight]);

  useEffect(() => () => onHeight(0), [onHeight]);

  const valueRef = useRef(value);
  valueRef.current = value;
  const caretRef = useRef<number | null>(null);
  const lastShiftTap = useRef(0);
  const lastSpaceAt = useRef(0);
  const repeatRef = useRef<{ timer?: ReturnType<typeof setTimeout>; count: number }>({ count: 0 });
  const spaceRef = useRef<{ x: number; moved: boolean } | null>(null);

  const selection = (): [number, number] => {
    const el = inputRef.current;
    const len = valueRef.current.length;
    return [el?.selectionStart ?? len, el?.selectionEnd ?? len];
  };

  // Put the cursor back where the edit happened (a new value moves it to the end)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && caretRef.current !== null) {
      el.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  });

  // Capitalise at the start of a sentence (and after a message is sent)
  useEffect(() => {
    if (shift === 'lock') return;
    const before = value.slice(0, inputRef.current?.selectionStart ?? value.length);
    setShift(SENTENCE_START.test(before) ? 'once' : 'off');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const replace = (start: number, end: number, text: string) => {
    const v = valueRef.current;
    const next = v.slice(0, start) + text + v.slice(end);
    valueRef.current = next;
    caretRef.current = start + text.length;
    onChange(next);
  };

  const insert = (text: string) => {
    const [start, end] = selection();
    replace(start, end, text);
  };

  const typeChar = (ch: string) => {
    insert(layer === 'abc' && shift !== 'off' ? ch.toUpperCase() : ch);
    if (shift === 'once') setShift('off');
  };

  const typeSpace = () => {
    const [start, end] = selection();
    const before = valueRef.current.slice(0, start);
    // Double space after a word: full stop, like phone keyboards
    if (start === end && Date.now() - lastSpaceAt.current < DOUBLE_TAP_MS * 1.5 && /[\p{L}\p{N}] $/u.test(before)) {
      replace(start - 1, end, '. ');
      lastSpaceAt.current = 0;
      return;
    }
    lastSpaceAt.current = Date.now();
    insert(' ');
  };

  const backspace = (wholeWord = false) => {
    const [start, end] = selection();
    if (start !== end) return replace(start, end, '');
    if (start === 0) return;
    const before = valueRef.current.slice(0, start);
    const cut = wholeWord ? before.length - before.replace(/\S*\s*$/, '').length || 1 : graphemes(before).pop()!.length;
    replace(start - cut, start, '');
  };

  const stopRepeat = () => {
    clearTimeout(repeatRef.current.timer);
    repeatRef.current = { count: 0 };
  };

  const startBackspace = () => {
    backspace();
    const step = () => {
      repeatRef.current.count += 1;
      backspace(repeatRef.current.count > WORD_DELETE_AFTER);
      repeatRef.current.timer = setTimeout(step, repeatRef.current.count > WORD_DELETE_AFTER ? REPEAT_EVERY_MS * 3 : REPEAT_EVERY_MS);
    };
    repeatRef.current.timer = setTimeout(step, REPEAT_DELAY_MS);
  };

  useEffect(() => stopRepeat, []);

  const tapShift = () => {
    const now = Date.now();
    if (now - lastShiftTap.current < DOUBLE_TAP_MS) setShift('lock');
    else setShift((s) => (s === 'off' ? 'once' : 'off'));
    lastShiftTap.current = now;
  };

  const moveCaret = (steps: number) => {
    const el = inputRef.current;
    if (!el) return;
    const pos = Math.max(0, Math.min(valueRef.current.length, (el.selectionStart ?? 0) + steps));
    el.setSelectionRange(pos, pos);
  };

  /** Shared press handling: act on touch-down and keep the focus in the message box. */
  const press = (action: () => void, popupLabel?: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      tick();
      if (popupLabel) setPopup(popupLabel);
      action();
    },
    onPointerUp: () => popupLabel && setPopup(null),
    onPointerCancel: () => popupLabel && setPopup(null),
    onPointerLeave: () => popupLabel && setPopup(null),
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  /** For keys that close the keyboard: act on the finished tap, so it can't land on the chat underneath. */
  const tapUp = (action: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      tick();
    },
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: action,
  });

  const rows = layer === 'abc' ? LETTERS : layer === '123' ? NUMBERS : SYMBOLS;
  const upper = layer === 'abc' && shift !== 'off';

  const charKey = (ch: string) => {
    const label = upper ? ch.toUpperCase() : ch;
    const id = `${layer}:${ch}`;
    return (
      <button key={id} type="button" aria-label={label} className="ivy-key relative flex-1" {...press(() => typeChar(ch), id)}>
        {label}
        {popup === id && <span className="ivy-key-popup" aria-hidden="true">{label}</span>}
      </button>
    );
  };

  const shiftKey =
    layer === 'abc' ? (
      <button
        type="button"
        aria-label={shift === 'lock' ? 'Caps lock on' : 'Shift'}
        aria-pressed={shift !== 'off'}
        className={`ivy-key ivy-key-fn flex-[1.5] ${shift !== 'off' ? 'ivy-key-on' : ''}`}
        {...press(tapShift)}
      >
        {shift === 'lock' ? <ArrowBigUpDash className="w-[22px] h-[22px]" /> : <ArrowBigUp className="w-[22px] h-[22px]" fill={shift === 'once' ? 'currentColor' : 'none'} />}
      </button>
    ) : (
      <button type="button" className="ivy-key ivy-key-fn flex-[1.5] text-[14px] tracking-tight whitespace-nowrap" {...press(() => setLayer(layer === '123' ? 'sym' : '123'))}>
        {layer === '123' ? '=\\<' : '?123'}
      </button>
    );

  return (
    <div
      ref={rootRef}
      className="ivy-keyboard fixed inset-x-0 z-40 select-none touch-none px-1 pb-[max(var(--safe-bottom),6px)]"
      style={{ bottom }}
      role="group"
      aria-label="Ivy keyboard"
      onPointerDown={(e) => e.preventDefault()}
    >
      {/* Quick emojis, the phone keyboard switch and hide */}
      <div className="flex items-center h-10 gap-0.5">
        <button type="button" aria-label="Use phone keyboard" title="Use phone keyboard" className="ivy-bar-btn" {...tapUp(onUsePhoneKeyboard)}>
          <Globe className="w-[18px] h-[18px]" />
        </button>
        <div className="flex-1 flex items-center justify-around min-w-0 overflow-hidden">
          {QUICK_EMOJI.map((emoji, i) => (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              // narrow phones show fewer, so nothing runs into the hide button
              className={`ivy-bar-btn text-[20px] shrink-0 ${i >= 6 ? 'max-[350px]:hidden' : ''}`}
              {...press(() => insert(emoji))}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Hide keyboard" title="Hide keyboard" className="ivy-bar-btn" {...tapUp(onClose)}>
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-[10px] pb-1">
        <div className="flex gap-[5px]">{rows[0].map(charKey)}</div>
        <div className={`flex gap-[5px] ${layer === 'abc' ? 'px-[5%]' : ''}`}>{rows[1].map(charKey)}</div>
        <div className="flex gap-[5px]">
          {shiftKey}
          {layer === 'abc' && <span className="w-[2px]" />}
          {rows[2].map(charKey)}
          {layer === 'abc' && <span className="w-[2px]" />}
          <button
            type="button"
            aria-label="Delete"
            className="ivy-key ivy-key-fn flex-[1.5]"
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              tick();
              startBackspace();
            }}
            onPointerUp={stopRepeat}
            onPointerCancel={stopRepeat}
            onMouseDown={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Delete className="w-[22px] h-[22px]" />
          </button>
        </div>
        <div className="flex gap-[5px]">
          <button type="button" className="ivy-key ivy-key-fn flex-[1.5] text-[14px] tracking-tight font-medium whitespace-nowrap" {...press(() => setLayer(layer === 'abc' ? '123' : 'abc'))}>
            {layer === 'abc' ? '?123' : 'ABC'}
          </button>
          <button type="button" aria-label="Emoji" className="ivy-key ivy-key-fn flex-1" {...tapUp(onEmoji)}>
            <Smile className="w-5 h-5" />
          </button>
          {charKey(',')}
          <button
            type="button"
            aria-label="Space"
            className="ivy-key flex-[4.5] text-[13px] text-[#8696a0]"
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              tick();
              spaceRef.current = { x: e.clientX, moved: false };
            }}
            onPointerMove={(e) => {
              const s = spaceRef.current;
              if (!s) return;
              const steps = Math.trunc((e.clientX - s.x) / CURSOR_STEP_PX);
              if (steps) {
                s.moved = true;
                s.x += steps * CURSOR_STEP_PX;
                moveCaret(steps);
              }
            }}
            onPointerUp={() => {
              if (spaceRef.current && !spaceRef.current.moved) typeSpace();
              spaceRef.current = null;
            }}
            onPointerCancel={() => (spaceRef.current = null)}
            onMouseDown={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          >
            space
          </button>
          {charKey('.')}
          <button type="button" aria-label="New line" className="ivy-key ivy-key-enter flex-[1.5]" {...press(() => insert('\n'))}>
            <CornerDownLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
