import { ShortcutKey, ShortcutKeys } from "./shortcut-key";
import { getPlatform } from "./platform";

/**
 * Format a keyboard shortcut for display in tooltips and UI (compact format).
 * Converts codes like `digit4` → `4`, `arrowleft` → `←`, etc.
 * Platform-aware: shows ⌘ on macOS, Ctrl on Windows.
 *
 * Compact format: macOS/iPad uses no separators (e.g., "⌘⇧Z")
 * Windows/other uses "+" as separator (e.g., "Ctrl+Shift+Z")
 */
export function shortcutKeysToString(shortcut: ShortcutKeys): string {
  const platform = getPlatform();
  const parts: string[] = [];

  for (const key of shortcut) {
    parts.push(formatShortcutKey(key, platform));
  }

  // On macOS/iPad, join without separator; on Windows/other, use "+"
  if (platform === "macos" || platform === "ipad") {
    return parts.join("");
  } else {
    return parts.join("+");
  }
}

/**
 * Format a keyboard shortcut for display in tooltips and UI (spaced format).
 * Converts codes like `digit4` → `4`, `arrowleft` → `←`, etc.
 * Platform-aware: shows ⌘ on macOS, Ctrl on Windows.
 */
export function formatShortcut(shortcut: ShortcutKeys): string {
  const platform = getPlatform();
  const parts: string[] = [];

  for (const key of shortcut) {
    parts.push(formatShortcutKey(key, platform));
  }

  return parts.join(" + ");
}

function formatShortcutKey(
  key: ShortcutKey,
  platform: "macos" | "windows" | "ipad" | "other"
): string {
  // Modifiers
  if (key === "meta") {
    return platform === "macos" || platform === "ipad" ? "⌘" : "Ctrl";
  }
  if (key === "control") {
    return "Ctrl";
  }
  if (key === "shift") {
    return "⇧";
  }
  if (key === "alt") {
    return platform === "macos" || platform === "ipad" ? "⌥" : "Alt";
  }

  // Digits
  if (key.startsWith("digit")) {
    return key.replace("digit", "");
  }

  // Arrows
  if (key === "arrowup") return "↑";
  if (key === "arrowdown") return "↓";
  if (key === "arrowleft") return "←";
  if (key === "arrowright") return "→";

  // Brackets
  if (key === "bracketleft") return "[";
  if (key === "bracketright") return "]";

  // Other special keys
  if (key === "backspace") return "⌫";
  if (key === "delete") return "⌦";
  if (key === "enter") return "↵";
  if (key === "escape") return "Esc";
  if (key === "tab") return "⇥";
  if (key === "space") return "Space";
  if (key === "comma") return ",";
  if (key === "period") return ".";
  if (key === "slash") return "/";
  if (key === "backslash") return "\\";
  if (key === "minus") return "-";
  if (key === "equal") return "=";
  if (key === "quote") return '"';
  if (key === "backquote") return "`";

  // Letters (uppercase for display)
  if (key.length === 1 && /[a-z]/.test(key)) {
    return key.toUpperCase();
  }

  // Fallback: capitalize first letter
  return key.charAt(0).toUpperCase() + key.slice(1);
}
