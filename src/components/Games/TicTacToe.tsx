import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { gameService, winningLine } from '../../services/gameService';
import { cardClass } from '../Couple/CoupleCards';

const MARKS: Record<string, string> = { X: '❤️', O: '💋' };

/** Live tic-tac-toe on one shared board. Win = 10 points, draw = 5 each, playing = 2. */
export const TicTacToe: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const board = useGameStore((s) => s.board);
  const award = useGameStore((s) => s.award);
  const refreshBoard = useGameStore((s) => s.refreshBoard);
  const addToast = useUIStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);

  const myMark = board?.x_player === me?.id ? 'X' : 'O';
  const myTurn = board?.status === 'playing' && board.turn === me?.id;
  const line = board ? winningLine(board.board) : null;
  const played = Boolean(board?.board.includes(myMark));

  // Award points once the round ends
  useEffect(() => {
    if (!board || !me || !played) return;
    if (board.status === 'won') {
      if (board.winner === me.id) void award('tic_tac_toe', 10, `ttt:${board.round}`);
      else void award('tic_tac_toe', 2, `ttt:${board.round}`);
    } else if (board.status === 'draw') {
      void award('tic_tac_toe', 5, `ttt:${board.round}`);
    }
  }, [board?.status, board?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = async (cell: number) => {
    if (!board || !me || !myTurn || busy) return;
    setBusy(true);
    try {
      const ok = await gameService.move(me.id, partner.id, board, cell);
      if (!ok) await refreshBoard();
    } catch {
      addToast('Move not saved — try again', 'error');
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!board || !me) return;
    try {
      await gameService.newGame(me.id, board);
    } catch {
      await refreshBoard();
    }
  };

  const status = !board
    ? 'Loading…'
    : board.status === 'idle'
    ? 'Start a game — you play ❤️ and go first'
    : board.status === 'playing'
    ? myTurn
      ? `Your turn (${MARKS[myMark]})`
      : `${partnerName}'s turn…`
    : board.status === 'draw'
    ? "It's a draw — you're perfect together 💞"
    : board.winner === me?.id
    ? 'You won! 🎉'
    : `${partnerName} won this one 😘`;

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74]">Heart tic-tac-toe</p>
        {board && board.status !== 'playing' && (
          <button onClick={start} className="inline-flex items-center gap-1 rounded-full bg-[#E05A74]/10 text-[#E05A74] px-3 py-1 text-xs font-semibold">
            <RotateCcw className="w-3.5 h-3.5" /> {board.status === 'idle' ? 'Start' : 'New game'}
          </button>
        )}
      </div>
      <p className="text-sm font-medium text-stone-700 dark:text-stone-200 mb-3" aria-live="polite">{status}</p>

      <div className="grid grid-cols-3 gap-2 max-w-[270px] mx-auto">
        {(board?.board || '---------').split('').map((c, i) => (
          <motion.button
            key={`${board?.round}-${i}`}
            whileTap={{ scale: 0.92 }}
            onClick={() => play(i)}
            disabled={!myTurn || c !== '-'}
            aria-label={`Cell ${i + 1}${c !== '-' ? `, ${c === 'X' ? 'heart' : 'kiss'}` : ''}`}
            className={`h-20 sm:h-[5.5rem] rounded-2xl text-4xl flex items-center justify-center transition-colors ${
              line?.includes(i)
                ? 'bg-[#E05A74]/20 ring-2 ring-[#E05A74]'
                : 'bg-white dark:bg-[#1E1D24] border border-rose-100 dark:border-stone-700'
            } ${myTurn && c === '-' ? 'hover:bg-rose-50 dark:hover:bg-stone-800 cursor-pointer' : ''}`}
          >
            {c !== '-' && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                {MARKS[c]}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
