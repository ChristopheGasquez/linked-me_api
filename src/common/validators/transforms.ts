import { Transform } from 'class-transformer';

const mapString = (fn: (s: string) => string) =>
  Transform(({ value }) => (typeof value === 'string' ? fn(value) : value));

/** Trim surrounding whitespace */
export const Trim = () => mapString((s) => s.trim());

/** Trim + lowercase (emails) */
export const TrimLowerCase = () => mapString((s) => s.trim().toLowerCase());

/** Trim + uppercase (role names) */
export const TrimUpperCase = () => mapString((s) => s.trim().toUpperCase());
