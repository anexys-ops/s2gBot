/**
 * URL du backend Laravel (sans /api).
 * Développement : machine locale accessible depuis le téléphone, ex.
 *   EXPO_PUBLIC_API_URL=http://192.168.1.10:8000 npx expo start
 * Production : https://s2g.apps-dev.fr (défaut).
 */
export const API_ORIGIN =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL?.trim()) ||
  'https://s2g.apps-dev.fr';

export const API_BASE = `${API_ORIGIN.replace(/\/$/, '')}/api`;
