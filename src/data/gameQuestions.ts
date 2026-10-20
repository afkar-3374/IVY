/** Question banks for the daily couple games. A new set is picked each day. */

export const DAILY_QUESTIONS = [
  'What was the exact moment you knew you liked me?',
  'What is your favourite memory of us so far?',
  'What little thing do I do that makes you smile?',
  'If we could teleport anywhere tonight, where would we go?',
  'What song reminds you of us?',
  'What is one thing you want us to do together this year?',
  'Describe our relationship in three words.',
  'What did you think of me the first time we talked?',
  'What is your idea of a perfect date with me?',
  'What is something you have never told me but want to?',
  'Which of my habits secretly makes you happiest?',
  'What do you miss most about me when we are apart?',
  'If our love story were a movie, what would it be called?',
  'What is one dream you want us to achieve together?',
  'What is the sweetest thing I have ever done for you?',
  'Where do you see us in five years?',
  'What is your favourite photo of us, and why?',
  'What food will always remind you of me?',
  'What is one thing about me you would never change?',
  'What made you laugh the hardest with me?',
  'If you could relive one day with me, which would it be?',
  'What is a small promise you want to make to me today?',
  'What do you love most about how we talk to each other?',
  'What is something new you want to learn together?',
  'How do you most like me to show you love?',
  'What is your favourite nickname I call you?',
  'What is the cutest thing about me when I am sleepy?',
  'What would our dream home look like?',
  'Which day with me would you put in a time capsule?',
  'What is one way I have made you a better person?',
  'If we had a theme song, what would it be?',
  'What is your favourite way to spend a lazy day with me?',
  'What should our next adventure be?',
  'What is something you are proud of us for?',
  'What do you want to tell me right now, honestly?',
  'What would you write on a love note to me today?',
  'What is your favourite thing about our chats?',
  'What makes you feel safe with me?',
  'If you could give me any gift in the world, what would it be?',
  'What is one thing we should celebrate this week?',
  'Which of our inside jokes is your favourite?',
  'What three things do you want to do with me before next year?',
  'What is your favourite compliment I have given you?',
  'If we were in a fairy tale, who would we be?',
  'What is a tradition you want us to start?',
  'What did you dream about recently?',
  'What would make tomorrow perfect for you?',
  'What is your favourite way I say goodnight?',
  'What colour reminds you of me, and why?',
  'What do you want our love to feel like in ten years?',
];

export interface WouldYouRather {
  a: string;
  b: string;
}

export const WOULD_YOU_RATHER: WouldYouRather[] = [
  { a: 'Breakfast in bed every Sunday', b: 'A surprise date every month' },
  { a: 'Travel the world together', b: 'Build our dream home together' },
  { a: 'Get a love letter', b: 'Get a long voice note' },
  { a: 'Stargazing on a rooftop', b: 'Sunset on a beach' },
  { a: 'Cook dinner together', b: 'Order in and watch a movie' },
  { a: 'Matching outfits', b: 'Matching tattoos' },
  { a: 'A cozy cabin in the snow', b: 'A villa by the sea' },
  { a: 'Dance in the rain', b: 'Cuddle under a blanket' },
  { a: 'Know all my thoughts', b: 'Know all my dreams' },
  { a: 'Relive our first date', b: 'Skip ahead to our wedding day' },
  { a: 'Road trip with no plan', b: 'Perfectly planned holiday' },
  { a: 'Always get the last fry', b: 'Always choose the movie' },
  { a: 'A puppy together', b: 'A kitten together' },
  { a: 'Late-night talks', b: 'Early-morning walks' },
  { a: 'Surprise party for me', b: 'Quiet day just us two' },
  { a: 'Write songs about us', b: 'Paint pictures of us' },
  { a: 'Picnic in the park', b: 'Candlelight dinner' },
  { a: 'Get flowers every week', b: 'Get chocolate every week' },
  { a: 'Hold hands everywhere', b: 'Hug every hour' },
  { a: 'Live in the city', b: 'Live in the countryside' },
  { a: 'Be able to teleport to each other', b: 'Be able to talk mind-to-mind' },
  { a: 'Watch the same show forever', b: 'Never watch the same thing twice' },
  { a: 'Sleep in together', b: 'Wake up early for sunrise' },
  { a: 'A big wedding', b: 'A small, secret wedding' },
  { a: 'Our song on repeat', b: 'A new playlist every week' },
  { a: 'Hot chocolate together', b: 'Ice cream together' },
  { a: 'Get lost in a new city', b: 'Revisit our favourite place' },
  { a: 'Speak every language', b: 'Play every instrument' },
  { a: 'A day at the amusement park', b: 'A day at the spa' },
  { a: 'Have a time machine', b: 'Have a pause button' },
  { a: 'Read each other poetry', b: 'Sing to each other' },
  { a: 'Camping under the stars', b: 'Luxury hotel suite' },
  { a: 'Know the future', b: 'Change the past' },
  { a: 'Forehead kisses', b: 'Back hugs' },
  { a: 'Breakfast date', b: 'Midnight snack date' },
  { a: 'Matching keychains', b: 'Matching phone wallpapers' },
  { a: 'Learn to cook together', b: 'Learn to dance together' },
  { a: 'A beach holiday', b: 'A snowy holiday' },
  { a: 'Send good-morning texts', b: 'Send good-night calls' },
  { a: 'Plant a garden together', b: 'Build a treehouse together' },
];

/**
 * The current date for the games. In development only, `localStorage.ivy_debug_today`
 * (YYYY-MM-DD) pretends it is another day so tests never use up the real daily rounds.
 */
export function gameNow(): Date {
  if (import.meta.env.DEV) {
    try {
      const override = localStorage.getItem('ivy_debug_today');
      if (override) return new Date(`${override}T12:00:00`);
    } catch {
      /* storage unavailable */
    }
  }
  return new Date();
}

/** Days since 1 Jan 2026 in local time — the same index for both partners each day. */
export function dayIndex(now = gameNow()): number {
  const start = new Date(2026, 0, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - start.getTime()) / 86_400_000);
}

/** Today's key (YYYY-MM-DD, local). */
export function todayKey(now = gameNow()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Pick `count` items for the day, rotating through the bank without repeats inside a day. */
export function pickForDay<T>(bank: T[], count: number, now = gameNow()): { item: T; index: number }[] {
  const start = (dayIndex(now) * count) % bank.length;
  return Array.from({ length: count }, (_, i) => {
    const index = (start + i) % bank.length;
    return { item: bank[index], index };
  });
}
