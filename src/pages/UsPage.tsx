import React from 'react';
import { Reveal } from '../components/ui/Reveal';
import { Link } from 'react-router-dom';
import { CoupleHero, LoveTapCard, MoodCard, SpecialDatesCard, cardClass } from '../components/Couple/CoupleCards';
import { WeeklyScores } from '../components/Games/WeeklyScores';
import { PushPrompt } from '../components/Couple/PushPrompt';
import { useGameStore } from '../store/useGameStore';
import { gardenLevel, sumBy } from '../utils/scores';

/** "Us" home: counter, moods, love taps and special dates. */
const GardenTeaser: React.FC = () => {
  const points = useGameStore((s) => s.points);
  const { current, next, progress } = gardenLevel(sumBy(points));
  return (
    <Link to="/garden" className={`${cardClass} lift p-5 flex items-center gap-4`}>
      <span className="text-4xl">{current.level < 3 ? '🌱' : current.level < 6 ? '🌷' : '🌹'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-800 dark:text-stone-100">Our garden · {current.name}</p>
        <div className="h-2 rounded-full bg-rose-50 dark:bg-stone-800 overflow-hidden mt-2">
          <div className="h-full rounded-full bg-gradient-to-r from-[#86EFAC] to-[#E05A74]" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-xs text-stone-500 mt-1">{next ? `Level ${current.level} → ${current.level + 1}` : 'Fully grown 💞'}</p>
      </div>
    </Link>
  );
};

const UsPage: React.FC = () => (
  <div className="flex-1 w-full max-w-5xl mx-auto px-4 pt-5 pb-[calc(7rem+var(--safe-bottom))] lg:px-8 lg:pt-8 lg:pb-10">
    <h1 className="font-serif italic text-4xl lg:text-5xl text-stone-800 dark:text-stone-100 mb-4 lg:mb-6">Just <span className="text-gradient pr-1">us</span> 💞</h1>
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 items-start">
      <div className="flex flex-col gap-4 lg:gap-6">
        <Reveal index={0}><CoupleHero /></Reveal>
        <Reveal index={1}><PushPrompt /></Reveal>
        <Reveal index={2}><LoveTapCard /></Reveal>
        <Reveal index={3}><GardenTeaser /></Reveal>
      </div>
      <div className="flex flex-col gap-4 lg:gap-6">
        <Reveal index={4}><WeeklyScores compact /></Reveal>
        <Reveal index={5}><MoodCard /></Reveal>
        <Reveal index={6}><SpecialDatesCard /></Reveal>
      </div>
    </div>
  </div>
);

export default UsPage;
