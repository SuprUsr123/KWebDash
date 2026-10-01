/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Device Detection Utilities
 * Conforms to Kindle Browser Compatibility Guide (Chromium 75 / ES2019).
 */

/**
 * Detects whether the current user is running on a PC / Desktop / Laptop browser.
 * Returns false on Mobile, Tablet, and Kindle / E-ink devices.
 */
export function isPCDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  let platform = '';
  if (navigator.platform) {
    platform = navigator.platform.toLowerCase();
  }

  // Explicit non-PC keywords (Mobile, Tablet, E-Reader / Kindle)
  const mobileKeywords = [
    'kindle',
    'silk',
    'e-ink',
    'android',
    'iphone',
    'ipad',
    'ipod',
    'windows phone',
    'iemobile',
    'blackberry',
    'mobile',
    'tablet'
  ];

  for (let i = 0; i < mobileKeywords.length; i++) {
    if (ua.indexOf(mobileKeywords[i]) !== -1) {
      return false;
    }
  }

  // Pointer / Touch checks
  // Kindle and mobile devices typically have no hover capability
  const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

  // If device is strictly touch and has no mouse hover, it's not a PC
  if (hasTouch && isCoarse && !hasHover) {
    return false;
  }

  // Check known PC desktop platforms
  const isDesktopPlatform =
    platform.indexOf('win') !== -1 ||
    platform.indexOf('mac') !== -1 ||
    platform.indexOf('linux') !== -1 ||
    platform.indexOf('cros') !== -1 ||
    platform.indexOf('x11') !== -1;

  if (isDesktopPlatform) {
    return true;
  }

  // Fallback for modern desktop browsers with fine pointer & hover
  return Boolean(hasHover && !isCoarse);
}
