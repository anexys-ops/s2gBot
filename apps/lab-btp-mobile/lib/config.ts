/**
 * URL du backend Laravel (sans suffixe /api — il est ajouté dans api.ts).
 * Développement : machine locale accessible depuis le téléphone, ex.
 *   EXPO_PUBLIC_API_URL=http://192.168.1.10:8000 npx expo start
 * Émulateur Android + `php artisan serve` sur le PC : http://10.0.2.2:8000
 * Après changement de .env : redémarrer Metro avec cache vidé (npx expo start -c).
 * Production : https://s2g.apps-dev.fr (défaut).
 */
export const API_ORIGIN =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL?.trim()) ||
  'https://s2g.apps-dev.fr';

export const API_BASE = `${API_ORIGIN.replace(/\/$/, '')}/api`;
