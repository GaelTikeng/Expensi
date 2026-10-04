/**
 * Seeded for every new user (F2.4). Names are user-editable afterwards; icons
 * are Ionicons glyphs. Order is the default display order.
 */
export const DEFAULT_CATEGORIES: readonly {
  name: string;
  icon: string;
  colorHex: string;
}[] = [
  { name: 'Food & Groceries', icon: 'cart-outline', colorHex: '#F39C12' },
  { name: 'Transport', icon: 'car-outline', colorHex: '#3498DB' },
  { name: 'Housing & Rent', icon: 'home-outline', colorHex: '#8E44AD' },
  { name: 'Utilities', icon: 'flash-outline', colorHex: '#F1C40F' },
  { name: 'Phone & Internet', icon: 'wifi-outline', colorHex: '#1ABC9C' },
  { name: 'Health', icon: 'medkit-outline', colorHex: '#E74C3C' },
  { name: 'Education', icon: 'school-outline', colorHex: '#2980B9' },
  { name: 'Family & Gifts', icon: 'gift-outline', colorHex: '#E91E63' },
  { name: 'Tithe & Donations', icon: 'heart-outline', colorHex: '#9B59B6' },
  { name: 'Entertainment', icon: 'film-outline', colorHex: '#FF7043' },
  { name: 'Clothing', icon: 'shirt-outline', colorHex: '#5D6D7E' },
  { name: 'Savings & Investments', icon: 'trending-up-outline', colorHex: '#27AE60' },
  { name: 'Business', icon: 'briefcase-outline', colorHex: '#34495E' },
  { name: 'Other', icon: 'ellipsis-horizontal-outline', colorHex: '#95A5A6' },
];
