import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Send } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { DAILY_QUESTIONS, WOULD_YOU_RATHER, dayIndex, pickForDay, todayKey } from '../../data/gameQuestions';
import { cardClass } from '../Couple/CoupleCards';
import type { DailyGame, GameAnswer } from '../../services/gameService';

function usePartners() {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  return { me, partner, partnerName: me?.nickname || partner.display_name };
}

/** Load today's rounds for a game and split answers into mine / partner's. */
function useRounds(game: DailyGame, roundKeys: string[]) {
  const { me } = usePartners();
  const answers = useGameStore((s) => s.answers);
  const loadAnswers = useGameStore((s) => s.loadAnswers);
  const keyString = roundKeys.join('|');

  useEffect(() => {
    void loadAnswers(game, roundKeys);
  }, [game, keyString]); // eslint-disable-line react-hooks/exhaustive-deps

  return roundKeys.map((key) => {
    const rows: GameAnswer[] = answers[`${game}:${key}`] || [];
    return {
      key,
      mine: rows.find((r) => r.user_id === me?.id),
      theirs: rows.find((r) => r.user_id !== me?.id),
      loaded: `${game}:${key}` in answers,
    };
  });
}

const Waiting: React.FC<{ name: string }> = ({ name }) => (
  <p className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
    <Lock className="w-3.5 h-3.5" /> Revealed when {name} answers too
  </p>
);

/* ── Daily question ── */
export const DailyQuestion: React.FC = () => {
  const { partnerName } = usePartners();
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const award = useGameStore((s) => s.award);
  const today = todayKey();
  const question = DAILY_QUESTIONS[dayIndex() % DAILY_QUESTIONS.length];
  const [round] = useRounds('daily_question', [today]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const both = Boolean(round.mine && round.theirs);

  useEffect(() => {
    if (both) void award('daily_question', 5, `dq-both:${today}`);
  }, [both, today, award]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    await submitAnswer('daily_question', today, { text: text.trim() });
    void award('daily_question', 5, `dq:${today}`);
    setSending(false);
  };

  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-1">Today's question</p>
      <h3 className="font-serif italic text-xl text-stone-800 dark:text-stone-100 mb-4">{question}</h3>

      {!round.loaded ? null : !round.mine ? (
        <div className="flex flex-col gap-2">
          {round.theirs && <p className="text-xs font-semibold text-[#E05A74]">💌 {partnerName} has answered — answer to see it!</p>}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Write from the heart…"
            className="w-full rounded-2xl border border-rose-100 dark:border-stone-700 bg-white/80 dark:bg-[#16151A] px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#E05A74]/30"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="btn-gloss self-end inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
          >
            <Send className="w-4 h-4" /> Answer
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-rose-50/80 dark:bg-stone-800/60 p-3">
            <p className="text-[11px] font-bold text-stone-500 mb-1">You</p>
            <p className="text-sm text-stone-800 dark:text-stone-100 whitespace-pre-wrap">{(round.mine.answer as { text: string })?.text}</p>
          </div>
          <div className="rounded-2xl bg-violet-50/80 dark:bg-stone-800/60 p-3">
            <p className="text-[11px] font-bold text-stone-500 mb-1">{partnerName}</p>
            {round.theirs ? (
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-stone-800 dark:text-stone-100 whitespace-pre-wrap">
                {(round.theirs.answer as { text: string })?.text}
              </motion.p>
            ) : (
              <Waiting name={partnerName} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Would you rather ── */
export const WouldYouRatherGame: React.FC = () => {
  const { partnerName } = usePartners();
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const award = useGameStore((s) => s.award);
  const today = todayKey();
  const prompts = useMemo(() => pickForDay(WOULD_YOU_RATHER, 3), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const rounds = useRounds('would_you_rather', prompts.map((p) => `${today}:${p.index}`));

  // 5 points each time you both picked the same
  useEffect(() => {
    rounds.forEach((r) => {
      const a = r.mine?.answer as { pick: string } | undefined;
      const b = r.theirs?.answer as { pick: string } | undefined;
      if (a && b && a.pick === b.pick) void award('would_you_rather', 5, `wyr:${r.key}`);
    });
  }, [rounds.map((r) => `${r.key}${r.mine ? 1 : 0}${r.theirs ? 1 : 0}`).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-1">Would you rather…</p>
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Pick one each. 5 points when you match!</p>
      <div className="flex flex-col gap-3">
        {prompts.map(({ item }, i) => {
          const r = rounds[i];
          const mine = (r.mine?.answer as { pick: 'a' | 'b' } | undefined)?.pick;
          const theirs = (r.theirs?.answer as { pick: 'a' | 'b' } | undefined)?.pick;
          return (
            <div key={r.key} className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
              {(['a', 'b'] as const).map((side, si) => (
                <React.Fragment key={side}>
                  {si === 1 && <span className="self-center font-serif italic text-sm text-stone-400">or</span>}
                  <button
                    disabled={Boolean(mine) || !r.loaded}
                    onClick={async () => {
                      await submitAnswer('would_you_rather', r.key, { pick: side });
                      void award('would_you_rather', 2, `wyr-play:${r.key}`);
                    }}
                    className={`relative rounded-2xl px-3 py-3 text-xs font-semibold text-left transition-all min-h-[64px] ${
                      mine === side
                        ? 'bg-[#E05A74] text-white shadow-soft'
                        : 'bg-white dark:bg-[#1E1D24] text-stone-700 dark:text-stone-200 border border-rose-100 dark:border-stone-700 enabled:hover:border-[#E05A74]'
                    }`}
                  >
                    {item[side]}
                    {mine && theirs === side && (
                      <span className="absolute -top-2 -right-1 rounded-full bg-violet-500 text-white text-[9px] px-1.5 py-0.5">{partnerName}</span>
                    )}
                    {mine === side && theirs === side && <Check className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5" />}
                  </button>
                </React.Fragment>
              ))}
              {mine && !theirs && (
                <div className="col-span-3 -mt-1">
                  <Waiting name={partnerName} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
