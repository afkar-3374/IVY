import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { seal, open } from './crypto/coupleCrypto';

export type PointSource = 'tap' | 'hug' | 'daily_question' | 'know_me' | 'would_you_rather' | 'tic_tac_toe' | 'garden';
export type DailyGame = 'daily_question' | 'know_me' | 'would_you_rather';

export interface PointRow {
  id: string;
  user_id: string;
  source: PointSource;
  points: number;
  ref: string;
  created_at: string;
}

export interface GameAnswer {
  game: DailyGame;
  round_key: string;
  user_id: string;
  answer: unknown;
  created_at: string;
}

export interface GardenBuild {
  item: string;
  built_by: string;
  cost: number;
  created_at: string;
}

export interface TicTacToe {
  round: number;
  board: string;
  x_player: string | null;
  turn: string | null;
  status: 'idle' | 'playing' | 'won' | 'draw';
  winner: string | null;
  updated_at: string;
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** 'X' | 'O' when someone has three in a row, 'draw' when full, otherwise null. */
export function boardResult(board: string): 'X' | 'O' | 'draw' | null {
  for (const [a, b, c] of LINES) {
    if (board[a] !== '-' && board[a] === board[b] && board[a] === board[c]) return board[a] as 'X' | 'O';
  }
  return board.includes('-') ? null : 'draw';
}

export function winningLine(board: string): number[] | null {
  return LINES.find(([a, b, c]) => board[a] !== '-' && board[a] === board[b] && board[a] === board[c]) || null;
}

class GameService {
  async getPoints(): Promise<PointRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('love_points')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20000);
    if (error) {
      logger.error('Unable to load love points:', error.message);
      return [];
    }
    return data as PointRow[];
  }

  /** Award points once per `ref` (repeat awards are ignored by the database). */
  async award(source: PointSource, points: number, ref: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('love_points')
      .upsert({ source, points, ref }, { onConflict: 'user_id,ref', ignoreDuplicates: true });
    if (error) logger.error('Unable to award points:', error.message);
  }

  async getAnswers(game: DailyGame, roundKeys: string[]): Promise<GameAnswer[]> {
    if (!supabase || roundKeys.length === 0) return [];
    const { data, error } = await supabase.from('game_answers').select('*').eq('game', game).in('round_key', roundKeys);
    if (error) {
      logger.error('Unable to load answers:', error.message);
      return [];
    }
    return Promise.all(
      (data || []).map(async (row) => {
        let answer: unknown = null;
        try {
          answer = JSON.parse(await open(row.answer));
        } catch {
          answer = null;
        }
        return { ...row, answer } as GameAnswer;
      })
    );
  }

  async submitAnswer(game: DailyGame, roundKey: string, answer: unknown): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('game_answers')
      .insert({ game, round_key: roundKey, answer: await seal(JSON.stringify(answer)) });
    if (error && error.code !== '23505') throw new Error(error.message);
  }

  async getBoard(): Promise<TicTacToe | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('tic_tac_toe').select('*').eq('id', 1).single();
    if (error) {
      logger.error('Unable to load board:', error.message);
      return null;
    }
    return data as TicTacToe;
  }

  /** Start a new round; the starter plays ❤️ (X) and moves first. */
  async newGame(me: string, current: TicTacToe): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('tic_tac_toe')
      .update({
        round: current.round + 1,
        board: '---------',
        x_player: me,
        turn: me,
        status: 'playing',
        winner: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .eq('round', current.round);
    if (error) throw new Error(error.message);
  }

  /** Place a mark; only applies if the board hasn't changed since we saw it. */
  async move(me: string, partnerId: string, current: TicTacToe, cell: number): Promise<boolean> {
    if (!supabase || current.status !== 'playing' || current.turn !== me || current.board[cell] !== '-') return false;
    const mark = current.x_player === me ? 'X' : 'O';
    const board = current.board.slice(0, cell) + mark + current.board.slice(cell + 1);
    const result = boardResult(board);
    const { data, error } = await supabase
      .from('tic_tac_toe')
      .update({
        board,
        turn: result ? null : partnerId,
        status: result === 'draw' ? 'draw' : result ? 'won' : 'playing',
        winner: result && result !== 'draw' ? me : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .eq('round', current.round)
      .eq('board', current.board)
      .select('id');
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  async getBuilds(): Promise<GardenBuild[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('garden_builds').select('*').order('created_at');
    if (error) {
      logger.error('Unable to load garden builds:', error.message);
      return [];
    }
    return data as GardenBuild[];
  }

  async build(item: string, cost: number): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('garden_builds').insert({ item, cost });
    if (error && error.code !== '23505') throw new Error(error.message);
  }

  subscribe(handlers: {
    onBuild: (row: GardenBuild) => void;
    onPoint: (row: PointRow) => void;
    onAnswer: () => void;
    onBoard: (board: TicTacToe) => void;
  }): () => void {
    if (!supabase) return () => {};
    const client = supabase;
    const channel = client
      .channel('ivy_games')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'love_points' }, (p) => handlers.onPoint(p.new as PointRow))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_answers' }, () => handlers.onAnswer())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'garden_builds' }, (p) => handlers.onBuild(p.new as GardenBuild))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tic_tac_toe' }, (p) => handlers.onBoard(p.new as TicTacToe))
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }
}

export const gameService = new GameService();
