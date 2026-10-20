import React from 'react';
import { CoupleHero, LoveTapCard, MoodCard, SpecialDatesCard } from '../components/Couple/CoupleCards';

/** "Us" home: counter, moods, love taps and special dates. */
const UsPage: React.FC = () => (
  <div className="flex-1 w-full max-w-5xl mx-auto px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
    <h1 className="font-cute text-3xl font-semibold text-stone-800 dark:text-stone-100 mb-4 lg:mb-6">Us 💞</h1>
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 items-start">
      <div className="flex flex-col gap-4 lg:gap-6">
        <CoupleHero />
        <LoveTapCard />
      </div>
      <div className="flex flex-col gap-4 lg:gap-6">
        <MoodCard />
        <SpecialDatesCard />
      </div>
    </div>
  </div>
);

export default UsPage;
