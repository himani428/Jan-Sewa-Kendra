export const DAY = 86400000;
export const SLA_DAYS = 45; // demo processing deadline (days) — configurable assumption, not a legal rule
export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const today0 = () => startOfDay(Date.now());
export const REQUIRED = {
  sale: ['aadhaar', 'deed', 'khatauni', 'stamp'],
  inheritance: ['aadhaar', 'death_cert', 'family_register', 'khatauni', 'affidavit'],
};
