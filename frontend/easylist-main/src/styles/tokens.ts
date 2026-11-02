/**
 * EasyList Design System Tokens
 * Product: EasyList by Avenzo Technologies
 *
 * Centralized design tokens for colors, typography, spacing, border radius,
 * shadows, and responsive breakpoints.
 */

export const colors = {
  // Brand Palette
  primaryNavy: '#111C35',
  primaryBlue: '#087BFA',
  accentBlue: '#3B9BFF',

  // Surfaces & Backgrounds
  pageBackground: '#F0F5FC',
  dashboardBackground: '#F5F7FB',
  white: '#FFFFFF',

  // Typography & Content
  primaryText: '#111827',
  secondaryText: '#64748B',

  // Form Controls
  inputBorder: '#DCE5F2',
  placeholderText: '#8296B5',

  // Semantic Status Accents
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  info: '#0284C7',
  infoLight: '#F0F9FF',
} as const;

export const fonts = {
  heading: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  tamil: '"Noto Sans Tamil", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const;

export const breakpoints = {
  // Mobile Breakpoints
  mobileSm: '360px',
  mobileMd: '390px',
  mobileLg: '430px',

  // Tablet Breakpoint
  tablet: '768px',

  // Desktop Breakpoints
  desktopSm: '1024px',
  desktopMd: '1280px',
  desktopLg: '1440px',
} as const;

export const radii = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  '3xl': '1.5rem', // 24px
  full: '9999px',
} as const;

export const shadows = {
  xs: '0 1px 2px 0 rgba(17, 28, 53, 0.05)',
  sm: '0 1px 3px 0 rgba(17, 28, 53, 0.08), 0 1px 2px -1px rgba(17, 28, 53, 0.06)',
  md: '0 4px 6px -1px rgba(17, 28, 53, 0.08), 0 2px 4px -2px rgba(17, 28, 53, 0.04)',
  lg: '0 10px 15px -3px rgba(17, 28, 53, 0.08), 0 4px 6px -4px rgba(17, 28, 53, 0.03)',
  xl: '0 20px 25px -5px rgba(17, 28, 53, 0.1), 0 8px 10px -6px rgba(17, 28, 53, 0.05)',
  card: '0 2px 8px -2px rgba(17, 28, 53, 0.06), 0 1px 3px -1px rgba(17, 28, 53, 0.04)',
  focus: '0 0 0 3px rgba(8, 123, 250, 0.25)',
} as const;

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const tokens = {
  colors,
  fonts,
  breakpoints,
  radii,
  shadows,
  transitions,
} as const;

export type Colors = typeof colors;
export type Fonts = typeof fonts;
export type Breakpoints = typeof breakpoints;
export type Radii = typeof radii;
export type Shadows = typeof shadows;
export type Transitions = typeof transitions;
export type Tokens = typeof tokens;

export default tokens;
