// Web Crypto API utilities for API key encryption

/**
 * Generate a key for encryption/decryption
 * Uses a password-based key derivation
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create a device-specific password
 * This is stored in localStorage and used to encrypt/decrypt the API key
 */
function getDevicePassword(): string {
  const key = 'ff-device-key';
  let password = localStorage.getItem(key);
  
  if (!password) {
    // Generate a random password unique to this browser/device
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    password = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(key, password);
  }
  
  return password;
}

/**
 * Encrypt a string value
 */
export async function encryptValue(value: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    
    // Generate a random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from device password
    const password = getDevicePassword();
    const key = await deriveKey(password, salt);
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt value');
  }
}

/**
 * Decrypt an encrypted string value
 */
export async function decryptValue(encryptedValue: string): Promise<string> {
  try {
    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedValue)
        .split('')
        .map(char => char.charCodeAt(0))
    );
    
    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    // Derive key from device password
    const password = getDevicePassword();
    const key = await deriveKey(password, salt);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt value');
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined';
}

/**
 * Generate a random ID
 */
export function generateRandomId(length: number = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a value (one-way)
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

