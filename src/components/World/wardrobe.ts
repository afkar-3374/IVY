/** Everything you can wear in our world, and what it costs in love coins. */

export type Slot = 'hair' | 'top' | 'bottom' | 'shoes' | 'hat' | 'glasses' | 'extra';

export interface Look {
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  hat: string;
  glasses: string;
  extra: string;
}

export interface Cloth {
  id: string;
  slot: Slot;
  name: string;
  emoji: string;
  /** Love coins (0 = free for everyone) */
  cost: number;
}

export const CLOTHES: Cloth[] = [
  { id: 'short', slot: 'hair', name: 'Short', emoji: '💇', cost: 0 },
  { id: 'ponytail', slot: 'hair', name: 'Ponytail', emoji: '🎀', cost: 0 },
  { id: 'long', slot: 'hair', name: 'Long', emoji: '💁', cost: 0 },
  { id: 'bob', slot: 'hair', name: 'Bob', emoji: '👩', cost: 30 },
  { id: 'spiky', slot: 'hair', name: 'Spiky', emoji: '⚡', cost: 30 },
  { id: 'buns', slot: 'hair', name: 'Space buns', emoji: '🍡', cost: 45 },
  { id: 'curly', slot: 'hair', name: 'Curly', emoji: '🌀', cost: 50 },

  { id: 'tee', slot: 'top', name: 'T-shirt', emoji: '👕', cost: 0 },
  { id: 'tank', slot: 'top', name: 'Tank top', emoji: '🎽', cost: 20 },
  { id: 'shirt', slot: 'top', name: 'Shirt', emoji: '👔', cost: 30 },
  { id: 'hoodie', slot: 'top', name: 'Hoodie', emoji: '🧥', cost: 45 },
  { id: 'sweater', slot: 'top', name: 'Cosy sweater', emoji: '🧶', cost: 50 },
  { id: 'dress', slot: 'top', name: 'Dress', emoji: '👗', cost: 60 },
  { id: 'jacket', slot: 'top', name: 'Jacket', emoji: '🧥', cost: 80 },

  { id: 'pants', slot: 'bottom', name: 'Trousers', emoji: '👖', cost: 0 },
  { id: 'shorts', slot: 'bottom', name: 'Shorts', emoji: '🩳', cost: 0 },
  { id: 'skirt', slot: 'bottom', name: 'Skirt', emoji: '🩰', cost: 0 },
  { id: 'jeans', slot: 'bottom', name: 'Jeans', emoji: '👖', cost: 35 },

  { id: 'sneakers', slot: 'shoes', name: 'Sneakers', emoji: '👟', cost: 0 },
  { id: 'sandals', slot: 'shoes', name: 'Sandals', emoji: '🩴', cost: 20 },
  { id: 'boots', slot: 'shoes', name: 'Boots', emoji: '🥾', cost: 40 },

  { id: 'none', slot: 'hat', name: 'No hat', emoji: '🚫', cost: 0 },
  { id: 'cap', slot: 'hat', name: 'Cap', emoji: '🧢', cost: 30 },
  { id: 'beanie', slot: 'hat', name: 'Beanie', emoji: '🧶', cost: 30 },
  { id: 'bow', slot: 'hat', name: 'Big bow', emoji: '🎀', cost: 25 },
  { id: 'flowers', slot: 'hat', name: 'Flower crown', emoji: '🌸', cost: 60 },
  { id: 'catears', slot: 'hat', name: 'Cat ears', emoji: '🐱', cost: 70 },
  { id: 'headphones', slot: 'hat', name: 'Headphones', emoji: '🎧', cost: 60 },
  { id: 'crown', slot: 'hat', name: 'Royal crown', emoji: '👑', cost: 150 },

  { id: 'none', slot: 'glasses', name: 'No glasses', emoji: '🚫', cost: 0 },
  { id: 'round', slot: 'glasses', name: 'Round glasses', emoji: '👓', cost: 30 },
  { id: 'sun', slot: 'glasses', name: 'Sunglasses', emoji: '🕶️', cost: 40 },
  { id: 'heart', slot: 'glasses', name: 'Heart glasses', emoji: '😍', cost: 50 },

  { id: 'none', slot: 'extra', name: 'Nothing', emoji: '🚫', cost: 0 },
  { id: 'scarf', slot: 'extra', name: 'Scarf', emoji: '🧣', cost: 40 },
  { id: 'backpack', slot: 'extra', name: 'Backpack', emoji: '🎒', cost: 50 },
  { id: 'cape', slot: 'extra', name: 'Cape', emoji: '🦸', cost: 120 },
  { id: 'wings', slot: 'extra', name: 'Angel wings', emoji: '🪽', cost: 200 },
];

/** Unique id across slots ('hat:none', 'top:dress') */
export const clothKey = (c: Pick<Cloth, 'slot' | 'id'>) => `${c.slot}:${c.id}`;

export const SLOTS: { slot: Slot | 'skin'; label: string; emoji: string; color?: keyof Look }[] = [
  { slot: 'hair', label: 'Hair', emoji: '💇', color: 'hairColor' },
  { slot: 'top', label: 'Tops', emoji: '👕', color: 'topColor' },
  { slot: 'bottom', label: 'Bottoms', emoji: '👖', color: 'bottomColor' },
  { slot: 'shoes', label: 'Shoes', emoji: '👟', color: 'shoesColor' },
  { slot: 'hat', label: 'Hats', emoji: '🎩' },
  { slot: 'glasses', label: 'Glasses', emoji: '👓' },
  { slot: 'extra', label: 'Extras', emoji: '✨' },
  { slot: 'skin', label: 'Skin', emoji: '🎨' },
];

export const SKINS = ['#FBE0CC', '#F2C7A5', '#E0A982', '#C68862', '#8D5A3B', '#5C3A24'];
export const HAIR_COLOURS = ['#2B1B17', '#5B3A29', '#A0522D', '#E6BE8A', '#F5F5F4', '#B91C1C', '#EC4899', '#6D28D9', '#2563EB'];
export const CLOTH_COLOURS = ['#F472B6', '#FB7185', '#F87171', '#FB923C', '#FBBF24', '#34D399', '#60A5FA', '#1E3A8A', '#A78BFA', '#FFFFFF', '#A8A29E', '#292524'];

export function defaultLook(first: boolean): Look {
  return {
    skin: '#F2C7A5',
    hair: first ? 'short' : 'ponytail',
    hairColor: '#2B1B17',
    top: 'tee',
    topColor: first ? '#60A5FA' : '#F472B6',
    bottom: first ? 'pants' : 'skirt',
    bottomColor: first ? '#1E3A8A' : '#FFFFFF',
    shoes: 'sneakers',
    shoesColor: '#FFFFFF',
    hat: 'none',
    glasses: 'none',
    extra: 'none',
  };
}

/** Fill in anything missing (older saves, a new slot) */
export function completeLook(look: Partial<Look> | null | undefined, first: boolean): Look {
  return { ...defaultLook(first), ...(look || {}) };
}

/** Is it free or already bought? */
export function owns(owned: string[], c: Cloth): boolean {
  return c.cost === 0 || owned.includes(clothKey(c));
}
