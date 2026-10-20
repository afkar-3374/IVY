import React from 'react';
import { Reveal } from '../components/ui/Reveal';
import { Link } from 'react-router-dom';
import { HandHeart } from 'lucide-react';
import { WeeklyScores } from '../components/Games/WeeklyScores';
import { DailyQuestion, WouldYouRatherGame } from '../components/Games/DailyGames';
import { TicTacToe } from '../components/Games/TicTacToe';
import { cardClass } from '../components/Couple/CoupleCards';

/** Couple games and the weekly scoreboard. */
const PlayPage: React.FC = () => (
  <div className="w-full max-w-5xl mx-auto px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
    <h1 className="font-serif italic text-4xl text-stone-800 dark:text-stone-100">Play together</h1>
    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-5">New questions every day · points grow your garden 🌱</p>

    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 items-start">
      <div className="flex flex-col gap-4 lg:gap-6">
        <Reveal index={0}><WeeklyScores /></Reveal>
        <Reveal index={1}><DailyQuestion /></Reveal>
      </div>
      <div className="flex flex-col gap-4 lg:gap-6">
        <Reveal index={2}><WouldYouRatherGame /></Reveal>
        <Reveal index={3}><TicTacToe /></Reveal>
        <Link to="/love" className={`${cardClass} lift p-5 flex items-center gap-4`}>
          <div className="btn-gloss w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
            <HandHeart className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-stone-800 dark:text-stone-100">Virtual hug</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Hold the heart together · 5 points each</p>
          </div>
        </Link>
      </div>
    </div>
  </div>
);

export default PlayPage;
