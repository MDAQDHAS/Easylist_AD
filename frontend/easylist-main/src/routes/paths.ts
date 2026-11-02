/**
 * EasyList Route Paths
 * Centralized registry of application route definitions.
 */

export const ROUTES = {
  // Root
  HOME: '/',

  // Public Authentication Routes
  LOGIN: '/login',
  REGISTER: '/register',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Protected Core Application Routes
  DASHBOARD: '/dashboard',
  REVIEW: '/review',
  EXPORT: '/export',
  SETTINGS: '/settings',

  // System & Overview
  ABOUT: '/about',
  OVERVIEW: '/overview',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
