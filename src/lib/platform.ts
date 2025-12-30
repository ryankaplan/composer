export type Platform = "macos" | "windows" | "ipad" | "other";

/**
 * Returns the detected platform of the current environment
 */
export function getPlatform(): Platform {
  // Check for iPad first as it's the most specific
  if (isIpadUserAgent()) {
    return "ipad";
  }

  // Check for Windows
  if (isWindowsUserAgent()) {
    return "windows";
  }

  // Check for macOS - must be after iPad check to avoid false positives
  if (/Macintosh/.test(navigator.userAgent) && !("ontouchend" in document)) {
    return "macos";
  }

  // Default to Other for any other platform
  return "other";
}

/**
 * Detects if the current user agent is an iPad
 */
export function isIpadUserAgent(): boolean {
  return /iPad|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;
}

/**
 * Detects if the current user agent is Windows
 */
export function isWindowsUserAgent(): boolean {
  return /Windows/.test(navigator.userAgent);
}
