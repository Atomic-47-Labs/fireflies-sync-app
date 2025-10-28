// Browser Compatibility Detection Utility
import type { BrowserCompatibility } from '../../types';

/**
 * Detect browser name and version
 */
function detectBrowser(): { name: string; version: string } {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';

  // Edge (Chromium-based)
  if (ua.includes('Edg/')) {
    name = 'Edge';
    const match = ua.match(/Edg\/([\d.]+)/);
    version = match ? match[1] : 'Unknown';
  }
  // Chrome
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    name = 'Chrome';
    const match = ua.match(/Chrome\/([\d.]+)/);
    version = match ? match[1] : 'Unknown';
  }
  // Opera
  else if (ua.includes('OPR/')) {
    name = 'Opera';
    const match = ua.match(/OPR\/([\d.]+)/);
    version = match ? match[1] : 'Unknown';
  }
  // Firefox
  else if (ua.includes('Firefox/')) {
    name = 'Firefox';
    const match = ua.match(/Firefox\/([\d.]+)/);
    version = match ? match[1] : 'Unknown';
  }
  // Safari
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    name = 'Safari';
    const match = ua.match(/Version\/([\d.]+)/);
    version = match ? match[1] : 'Unknown';
  }

  return { name, version };
}

/**
 * Check if File System Access API is supported
 */
function checkFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Check if IndexedDB is supported
 */
function checkIndexedDB(): boolean {
  return 'indexedDB' in window;
}

/**
 * Check if Web Crypto API is supported
 */
function checkWebCrypto(): boolean {
  return 'crypto' in window && 'subtle' in window.crypto;
}

/**
 * Check if Fetch API is supported
 */
function checkFetchAPI(): boolean {
  return 'fetch' in window;
}

/**
 * Check if Service Worker is supported (for PWA)
 */
function checkServiceWorker(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Check if Notification API is supported
 */
function checkNotifications(): boolean {
  return 'Notification' in window;
}

/**
 * Parse version string to number for comparison
 */
function parseVersion(version: string): number {
  const parts = version.split('.').map(Number);
  return parts[0] * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
}

/**
 * Check if browser version meets minimum requirements
 */
function checkMinimumVersion(browserName: string, version: string): boolean {
  const versionNum = parseVersion(version);
  
  const minimumVersions: Record<string, number> = {
    'Chrome': parseVersion('86.0.0'),
    'Edge': parseVersion('86.0.0'),
    'Opera': parseVersion('72.0.0'),
  };

  const minVersion = minimumVersions[browserName];
  if (!minVersion) return false;
  
  return versionNum >= minVersion;
}

/**
 * Comprehensive browser compatibility check
 */
export function checkBrowserCompatibility(): BrowserCompatibility {
  const { name, version } = detectBrowser();
  const fileSystemAccessSupported = checkFileSystemAccess();
  const indexedDBSupported = checkIndexedDB();

  const requiredAPIs = {
    'File System Access API': fileSystemAccessSupported,
    'IndexedDB': indexedDBSupported,
    'Web Crypto API': checkWebCrypto(),
    'Fetch API': checkFetchAPI(),
    'Service Worker': checkServiceWorker(),
    'Notifications': checkNotifications()
  };

  // Browser is compatible if:
  // 1. It's a supported browser (Chrome, Edge, Opera)
  // 2. Version meets minimum requirements
  // 3. File System Access API is available
  // 4. IndexedDB is available
  const supportedBrowsers = ['Chrome', 'Edge', 'Opera'];
  const isSupportedBrowser = supportedBrowsers.includes(name);
  const meetsVersionRequirement = checkMinimumVersion(name, version);

  const isCompatible = 
    isSupportedBrowser &&
    meetsVersionRequirement &&
    fileSystemAccessSupported &&
    indexedDBSupported;

  return {
    isCompatible,
    browser: name,
    version,
    fileSystemAccessSupported,
    indexedDBSupported,
    requiredAPIs
  };
}

/**
 * Get user-friendly compatibility message
 */
export function getCompatibilityMessage(compat: BrowserCompatibility): string {
  if (compat.isCompatible) {
    return `✅ Your browser (${compat.browser} ${compat.version}) is fully compatible!`;
  }

  const issues: string[] = [];

  if (!['Chrome', 'Edge', 'Opera'].includes(compat.browser)) {
    issues.push(`Unsupported browser: ${compat.browser}`);
  }

  if (!compat.fileSystemAccessSupported) {
    issues.push('File System Access API not available');
  }

  if (!compat.indexedDBSupported) {
    issues.push('IndexedDB not available');
  }

  return `⚠️ Browser compatibility issues: ${issues.join(', ')}`;
}

/**
 * Get recommended browsers list
 */
export function getRecommendedBrowsers() {
  return [
    { name: 'Chrome', version: '86+', url: 'https://www.google.com/chrome/' },
    { name: 'Edge', version: '86+', url: 'https://www.microsoft.com/edge' },
    { name: 'Opera', version: '72+', url: 'https://www.opera.com/' }
  ];
}

/**
 * Check if running in secure context (HTTPS)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext;
}

/**
 * Get full compatibility report
 */
export function getCompatibilityReport() {
  const compat = checkBrowserCompatibility();
  const message = getCompatibilityMessage(compat);
  const recommended = getRecommendedBrowsers();
  const secure = isSecureContext();

  return {
    ...compat,
    message,
    recommendedBrowsers: recommended,
    isSecureContext: secure,
    canProceed: compat.isCompatible && secure
  };
}

