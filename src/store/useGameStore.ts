import { create } from 'zustand';
import {
  gameService,
  type DailyGame,
  type GameAnswer,
  type GardenBuild,
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
  builds: GardenBuild[];
  /** Item most recently built (by either partner), for the build animation */
  justBuilt: string | null;
  loaded: boolean;
  build: (item: string, cost: number) => Promise<boolean>;
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
  builds: [],
  justBuilt: null,
  loaded: false,

  init: () => {
    void (async () => {
      const [points, board, builds] = await Promise.all([gameService.getPoints(), gameService.getBoard(), gameService.getBuilds()]);
      set({ points, board, builds, loaded: true });
    })();
    return gameService.subscribe({
      onBuild: (row) => {
        if (get().builds.some((b) => b.item === row.item)) return;
        set((s) => ({ builds: [...s.builds, row], justBuilt: row.item }));
        const me = useAuthStore.getState().user?.id;
        if (row.built_by !== me) useUIStore.getState().addToast('Something new was built in your garden 🏗️💞', 'success');
      },
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

  build: async (item, cost) => {
    const me = useAuthStore.getState().user?.id;
    if (!me || get().builds.some((b) => b.item === item)) return false;
    try {
      await gameService.build(item, cost);
      set((s) => ({
        builds: s.builds.some((b) => b.item === item)
          ? s.builds
          : [...s.builds, { item, built_by: me, cost, created_at: new Date().toISOString() }],
        justBuilt: item,
      }));
      return true;
    } catch (err) {
      logger.error('Unable to build:', err);
      useUIStore.getState().addToast('Could not build — check your connection', 'error');
      return false;
    }
  },
}));
