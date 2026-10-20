import React from 'react';
import { Link } from 'react-router-dom';
import { HandHeart } from 'lucide-react';
import { WeeklyScores } from '../components/Games/WeeklyScores';
import { DailyQuestion, KnowMe, WouldYouRatherGame } from '../components/Games/DailyGames';
import { TicTacToe } from '../components/Games/TicTacToe';
import { cardClass } from '../components/Couple/CoupleCards';

/** Couple games and the weekly scoreboard. */
const PlayPage: React.FC = () => (
  <div className="w-full max-w-5xl mx-auto px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
    <h1 className="font-serif italic text-4xl text-stone-800 dark:text-stone-100">Play together</h1>
    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-5">New questions every day · points grow your garden 🌱</p>

    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 items-start">
      <div className="flex flex-col gap-4 lg:gap-6">
        <WeeklyScores />
        <DailyQuestion />
        <TicTacToe />
      </div>
      <div className="flex flex-col gap-4 lg:gap-6">
        <KnowMe />
        <WouldYouRatherGame />
        <Link to="/love" className={`${cardClass} p-5 flex items-center gap-4 hover:border-[#E05A74]/40 transition-colors`}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F27A93] to-[#E05A74] text-white flex items-center justify-center flex-shrink-0">
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
