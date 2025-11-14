/**
 * Redirect URI Helper
 * 
 * Generates appropriate redirect URIs for different platforms and environments
 * Ensures consistency between authorization request and token exchange
 */

import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';

/**
 * Get redirect URI for current platform and environment
 * 
 * Rules:
 * - Mobile (native): Use custom scheme via AuthSession.makeRedirectUri
 * - Web (localhost/127.0.0.1): Use current origin
 * - Web (production domain): Use current origin
 * 
 * CRITICAL: The redirect URI used in authorization request MUST
 * match EXACTLY with the one used in token exchange.
 * 
 * @returns string - Redirect URI for current platform
 */
export function getRedirectUri(): string {
  if (Platform.OS === 'web') {
    // Web: Use current origin, but replace localhost with 127.0.0.1 (Spotify requirement)
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      
      // Spotify doesn't allow "localhost" in redirect URIs (security policy)
      // Replace localhost with 127.0.0.1
      if (origin.includes('localhost')) {
        return origin.replace('localhost', '127.0.0.1');
      }
      
      return origin;
    }
    
    // Fallback (should never hit this in real scenarios)
    return 'http://127.0.0.1:8081';
  } else {
    // Mobile: Use custom scheme via AuthSession
    // This handles both dev and production builds correctly
    return AuthSession.makeRedirectUri({
      scheme: 'ratesangeet',
      path: 'callback',
    });
  }
}

/**
 * Validate if a URI is a valid redirect URI
 * 
 * Checks:
 * - Not empty
 * - Valid URL format
 * - Allowed scheme (http, https, or custom)
 * 
 * @param uri - URI to validate
 * @returns boolean - True if valid
 */
export function isValidRedirectUri(uri: string): boolean {
  if (!uri) return false;
  
  try {
    const url = new URL(uri);
    
    // Allow http/https for web, custom scheme for mobile
    const allowedSchemes = ['http', 'https', 'ratesangeet'];
    return allowedSchemes.includes(url.protocol.replace(':', ''));
  } catch {
    return false;
  }
}

/**
 * Get list of all redirect URIs that need to be registered in Spotify Dashboard
 * 
 * This is for documentation purposes - helps developers know what to register
 * 
 * NOTE: Spotify does NOT allow "localhost" in redirect URIs (security policy)
 * Use 127.0.0.1 instead for local development
 * 
 * @returns string[] - List of redirect URIs to register
 */
export function getAllRedirectUris(): string[] {
  return [
    // Local development (web) - Spotify REQUIRES 127.0.0.1, NOT localhost
    'http://127.0.0.1:8081',
    
    // Mobile (custom scheme)
    'ratesangeet://callback',
    
    // Production (web)
    'https://ratesangeet.onrender.com',
  ];
}
