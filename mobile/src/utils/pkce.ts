/**
 * PKCE (Proof Key for Code Exchange) Implementation
 * RFC 7636 compliant
 * 
 * Generates cryptographically secure code verifiers and challenges
 * for OAuth 2.0 authorization code flow with PKCE extension.
 */

import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

/**
 * Generate a cryptographically random code verifier
 * 
 * RFC 7636 Requirements:
 * - Length: 43-128 characters
 * - Characters: [A-Z] [a-z] [0-9] - . _ ~
 * 
 * Implementation:
 * - Generates 32 random bytes (256 bits of entropy)
 * - Base64URL encodes to 43 characters
 * 
 * @returns Promise<string> - Base64URL encoded random string (43 chars)
 */
export async function generateCodeVerifier(): Promise<string> {
  const randomBytes = new Uint8Array(32);
  
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto) {
    // Web: Use browser's native crypto API
    window.crypto.getRandomValues(randomBytes);
  } else {
    // Mobile: Use expo-crypto
    const bytes = Crypto.getRandomBytes(32);
    randomBytes.set(bytes);
  }
  
  return base64URLEncode(randomBytes);
}

/**
 * Generate code challenge from code verifier
 * 
 * RFC 7636 Requirements:
 * - Method: S256 (SHA-256)
 * - challenge = BASE64URL(SHA256(ASCII(verifier)))
 * 
 * CRITICAL: Must use BINARY SHA-256, not hex digest!
 * 
 * @param codeVerifier - The code verifier string
 * @returns Promise<string> - Base64URL encoded SHA-256 hash
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto?.subtle) {
    // Web: Use SubtleCrypto API (returns ArrayBuffer)
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(hashBuffer));
  } else {
    // Mobile: expo-crypto returns HEX string - we need BINARY!
    // Convert hex to binary then base64url encode
    const hexHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier
    );
    
    // Convert hex string to Uint8Array
    const bytes = new Uint8Array(hexHash.length / 2);
    for (let i = 0; i < hexHash.length; i += 2) {
      bytes[i / 2] = parseInt(hexHash.substr(i, 2), 16);
    }
    
    return base64URLEncode(bytes);
  }
}

/**
 * Base64URL encoding (RFC 4648 Section 5)
 * 
 * Differences from standard Base64:
 * - Use '-' instead of '+'
 * - Use '_' instead of '/'
 * - Remove trailing '=' padding
 * 
 * This makes the output safe for URLs and HTTP headers
 * 
 * @param buffer - Uint8Array to encode
 * @returns string - Base64URL encoded string
 */
export function base64URLEncode(buffer: Uint8Array): string {
  // Convert bytes to binary string
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  
  // Base64 encode
  const base64 = btoa(binary);
  
  // Convert to Base64URL
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
}

/**
 * Generate cryptographically secure random state parameter
 * 
 * Used to prevent CSRF attacks during OAuth flow
 * 
 * @returns string - Random state string (16 characters)
 */
export function generateState(): string {
  const randomBytes = new Uint8Array(12); // 12 bytes = 16 base64url chars
  
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    const bytes = Crypto.getRandomBytesAsync(12);
    // Note: This is a Promise, but for simplicity we'll use sync version
    const syncBytes = Crypto.getRandomBytes(12);
    randomBytes.set(syncBytes);
  }
  
  return base64URLEncode(randomBytes);
}
