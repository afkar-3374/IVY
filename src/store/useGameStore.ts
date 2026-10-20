import { create } from 'zustand';
import {
  gameService,
  type DailyGame,
  type GameAnswer,
  type PointRow,
  type PointSource,
  type TicTacToe,
} from '../services/gameService';
import { useAuthStore } from './useAuthStore';
import { useUIStore } from './useUIStore';
import { logger } from '../services/logger/logger';

interface GameState {
  points: PointRow[];
  /** `${game}:${round}` → answers from both partners */
  answers: Record<string, GameAnswer[]>;
  board: TicTacToe | null;
  loaded: boolean;
  init: () => () => void;
  award: (source: PointSource, points: number, ref: string) => Promise<void>;
  loadAnswers: (game: DailyGame, roundKeys: string[]) => Promise<void>;
  submitAnswer: (game: DailyGame, roundKey: string, answer: unknown) => Promise<void>;
  refreshBoard: () => Promise<void>;
}

/** Rounds currently on screen, so live answer updates know what to reload. */
const watchedRounds = new Map<DailyGame, string[]>();

export const useGameStore = create<GameState>((set, get) => ({
  points: [],
  answers: {},
  board: null,
  loaded: false,

  init: () => {
    void (async () => {
      const [points, board] = await Promise.all([gameService.getPoints(), gameService.getBoard()]);
      set({ points, board, loaded: true });
    })();
    return gameService.subscribe({
      onPoint: (row) => set((s) => (s.points.some((p) => p.id === row.id || (p.ref === row.ref && p.user_id === row.user_id))
        ? { points: s.points.map((p) => (p.ref === row.ref && p.user_id === row.user_id ? row : p)) }
        : { points: [row, ...s.points] })),
      onAnswer: () => {
        watchedRounds.forEach((rounds, game) => void get().loadAnswers(game, rounds));
      },
      onBoard: (board) => set({ board }),
    });
  },

  award: async (source, points, ref) => {
    const me = useAuthStore.getState().user?.id;
    if (!me) return;
    if (get().points.some((p) => p.user_id === me && p.ref === ref)) return;
    // Optimistic: the realtime echo replaces this row with the stored one
    const row: PointRow = { id: `local-${ref}`, user_id: me, source, points, ref, created_at: new Date().toISOString() };
    set((s) => ({ points: [row, ...s.points] }));
    await gameService.award(source, points, ref);
    if (points >= 3) useUIStore.getState().addToast(`+${points} love points 💖`, 'success');
  },

  loadAnswers: async (game, roundKeys) => {
    watchedRounds.set(game, roundKeys);
    const rows = await gameService.getAnswers(game, roundKeys);
    set((s) => {
      const answers = { ...s.answers };
      for (const key of roundKeys) answers[`${game}:${key}`] = rows.filter((r) => r.round_key === key);
      return { answers };
    });
  },

  submitAnswer: async (game, roundKey, answer) => {
    try {
      await gameService.submitAnswer(game, roundKey, answer);
      await get().loadAnswers(game, watchedRounds.get(game) || [roundKey]);
    } catch (err) {
      logger.error('Unable to submit answer:', err);
      useUIStore.getState().addToast('Could not save your answer', 'error');
    }
  },

  refreshBoard: async () => set({ board: await gameService.getBoard() }),
}));
