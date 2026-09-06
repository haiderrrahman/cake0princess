export const BISMAYAH_BUILDINGS = Array.from({ length: 920 - 101 + 1 }, (_, i) => String(i + 101));
export const BISMAYAH_APARTMENTS = [
  ...Array.from({ length: 12 }, (_, i) => `ارضي ${i + 1}`),
  ...Array.from({ length: 912 }, (_, i) => `شقة ${i + 1}`)
];
