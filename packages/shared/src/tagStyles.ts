import type { EventTag } from './types';

export type TagColorStyle = {
  backgroundColor: string;
  textColor: string;
};

export const TAG_COLORS: Partial<Record<EventTag, TagColorStyle>> = {
  social: { backgroundColor: '#FFE4E6', textColor: '#BE123C' },
  professional: { backgroundColor: '#FDE68A', textColor: '#92400E' },
  academic: { backgroundColor: '#E0E7FF', textColor: '#4338CA' },
  cultural: { backgroundColor: '#FEF3C7', textColor: '#B45309' },
  performance: { backgroundColor: '#FAE8FF', textColor: '#A21CAF' },
  movie: { backgroundColor: '#EDE9FE', textColor: '#6D28D9' },
  sports: { backgroundColor: '#FFEDD5', textColor: '#C2410C' },
  fitness: { backgroundColor: '#ECFCCB', textColor: '#4D7C0F' },
  gaming: { backgroundColor: '#EDE9FE', textColor: '#6D28D9' },
  volunteering: { backgroundColor: '#D1FAE5', textColor: '#047857' },
  religious: { backgroundColor: '#FEF9C3', textColor: '#A16207' },
  political: { backgroundColor: '#FEE2E2', textColor: '#B91C1C' },
  music: { backgroundColor: '#FCE7F3', textColor: '#BE185D' },
  art: { backgroundColor: '#CFFAFE', textColor: '#0E7490' },
  tech: { backgroundColor: '#EDE9FE', textColor: '#6D28D9' },
  business: { backgroundColor: '#DBEAFE', textColor: '#1D4ED8' },
  health: { backgroundColor: '#DCFCE7', textColor: '#15803D' },
  career: { backgroundColor: '#CCFBF1', textColor: '#0F766E' },
  study: { backgroundColor: '#F3E8FF', textColor: '#7E22CE' },
  free_food: { backgroundColor: '#FFEDD5', textColor: '#C2410C' },
  free_merch: { backgroundColor: '#FEF3C7', textColor: '#B45309' },
  networking: { backgroundColor: '#CFFAFE', textColor: '#0E7490' },
  hiring: { backgroundColor: '#FEE2E2', textColor: '#B91C1C' },
  beginner_friendly: { backgroundColor: '#ECFCCB', textColor: '#4D7C0F' },
  outdoor: { backgroundColor: '#DCFCE7', textColor: '#15803D' },
  online: { backgroundColor: '#CCFBF1', textColor: '#0F766E' },
  drop_in: { backgroundColor: '#DCFCE7', textColor: '#15803D' },
};

export const DEFAULT_TAG_COLOR: TagColorStyle = {
  backgroundColor: '#FFF7ED',
  textColor: '#9A3412',
};

export const formatTagLabel = (tag: string) =>
  tag
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const getTagColor = (tag: string): TagColorStyle =>
  TAG_COLORS[tag as EventTag] || DEFAULT_TAG_COLOR;