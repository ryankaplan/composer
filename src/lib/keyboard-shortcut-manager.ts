import { useEffect, DependencyList } from "react";
import { Platform, getPlatform } from "./platform";
import {
  ShortcutKey,
  ShortcutKeys,
  NormalizedShortcutKey,
  NormalizedShortcutKeys,
} from "./shortcut-key";

export type CustomShortcut = {
  id: string;
  actionId: string;
  keys: ShortcutKey[];
  parameters?: unknown;
};

export type ShortcutPriority = "user-custom" | "default";

/**
 * Maps a key to its platform-specific equivalent.
 * This allows us to define shortcuts using macOS conventions ('meta')
 * but correctly map them to Windows conventions ('control').
 */
export function mapShortcutKeyToPlatform(
  key: ShortcutKey,
  platform: Platform
): ShortcutKey {
  if (platform === "windows") {
    // Map macOS keys to Windows equivalents
    switch (key) {
      case "meta":
        return "control";
      default:
        return key;
    }
  } else {
    // On macOS and other platforms, use the original key
    return key;
  }
}

/**
 * Maps an array of shortcut keys to their platform-specific equivalents.
 */
export function mapShortcutKeysToPlatform(
  shortcut: ReadonlyArray<ShortcutKey>,
  platform: Platform
): ReadonlyArray<ShortcutKey> {
  return shortcut.map((key) => mapShortcutKeyToPlatform(key, platform));
}

function isTextAreaOrTextInput(element: EventTarget): boolean {
  if (element instanceof HTMLInputElement) {
    return (
      element.type === "text" ||
      element.type === "email" ||
      element.type === "password" ||
      element.type === "search" ||
      element.type === "url" ||
      element.type === "tel" ||
      element.type === "number"
    );
  }

  if (element instanceof HTMLElement && element.contentEditable === "true") {
    return true;
  }

  return element instanceof HTMLTextAreaElement;
}

type ShortcutAction = (() => void) | (() => () => void);

type RegisteredShortcut = {
  action: ShortcutAction;
  priority: ShortcutPriority;
};

function normalizeEventCode(code: string): ShortcutKey {
  code = code.toLowerCase();

  if (code === "shiftleft" || code === "shiftright") {
    return "shift";
  } else if (code === "controlleft" || code === "controlright") {
    return "control";
  } else if (code === "altleft" || code === "altright") {
    return "alt";
  } else if (code === "metaleft" || code === "metaright") {
    return "meta";
  }

  return code as ShortcutKey;
}

/**
 * Normalizes user-facing shortcut definitions to canonical form for registration.
 *
 * When the user does Alt + x on macOS, the browser produces '≈' as the character.
 * This is true for many different keys. So when we're registering a shortcut and
 * Alt is present with letter keys in a shortcut, we convert e.g. 'x' to 'keyX'.
 * This matches what normalizedKeyOrCode() produces at runtime.
 */
export function normalizeShortcutKeys(
  shortcut: ShortcutKeys
): NormalizedShortcutKeys {
  const hasModifier = shortcut.some((k) => k === "alt");

  return shortcut.map((k) => {
    if (hasModifier && k.length === 1 && /[a-z]/i.test(k)) {
      return `key${k.toLowerCase()}` as NormalizedShortcutKey;
    }
    return k.toLowerCase() as NormalizedShortcutKey;
  }) as NormalizedShortcutKeys;
}

/**
 * Converts canonical shortcut keys back to user-facing form for storage.
 *
 * This reverses the normalization: 'keyX' becomes 'x' when Alt/Ctrl/Meta are present.
 * Used when capturing shortcuts in the UI for storage in CustomShortcut.
 */
export function denormalizeShortcutKeys(
  canonicalKeys: readonly NormalizedShortcutKey[]
): ShortcutKeys {
  const hasModifier = canonicalKeys.some((k) => k === "alt");

  return canonicalKeys.map((k) => {
    if (
      hasModifier &&
      typeof k === "string" &&
      k.startsWith("key") &&
      k.length === 4 &&
      /[a-z]/.test(k[3]!)
    ) {
      return k[3] as ShortcutKey;
    }
    return k as ShortcutKey;
  }) as ShortcutKeys;
}

/**
  IMPORTANT: Layout-aware vs. position-based keys

  For **letters without modifiers**, use `event.key` (layout-aware). On AZERTY,
  the physical key labeled `KeyQ` produces `'a'`, and shortcuts should trigger
  by the **character** the user typed (e.g., `'a'`) rather than the physical
  position.

  For **letters with Alt/Ctrl/Meta**, use `event.code` (position-based). These
  modifiers produce special characters (e.g., Alt+X = '≈' on macOS), making
  event.key unreliable. We fall back to the physical key code (e.g., 'KeyX').
  Note: Shift is excluded because it only produces uppercase letters.

  For **non-letters** (digits, brackets, arrows, etc.), use `event.code`. This
  ensures shortcuts like 'digit1' consistently refer to the physical key position,
  even if typing the character requires Shift on some layouts.
 */
export function normalizedKeyOrCode(e: KeyboardEvent): NormalizedShortcutKey {
  const k = e.key;

  // Use event.key for letters, but only when no Alt modifier is present.
  const hasModifier = e.altKey;
  if (k && k.length === 1 && /[a-z]/i.test(k) && !hasModifier) {
    return k.toLowerCase() as ShortcutKey;
  }

  // Use event.code for non-letters and letters with modifiers.
  const code = e.code || "";
  return normalizeEventCode(code);
}

class ShortcutManager {
  private shortcuts = new Map<string, Array<RegisteredShortcut>>();
  private pressedKeys = new Set<NormalizedShortcutKey>();
  private isPaused = false;

  private activeShortcut: {
    key: string;
    registeredShortcut: RegisteredShortcut;
    onRelease?: (() => void) | null;
  } | null = null;

  constructor() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  pause() {
    this.isPaused = true;
    return () => {
      this.isPaused = false;
    };
  }

  isKeyPressed(key: NormalizedShortcutKey): boolean {
    return this.pressedKeys.has(key);
  }

  registerShortcut(
    shortcut: ShortcutKeys,
    action: ShortcutAction,
    priority: ShortcutPriority
  ): () => void {
    const canonicalShortcut = normalizeShortcutKeys(shortcut);
    const key = [...canonicalShortcut].sort().join(" ");

    const shortcuts = this.shortcuts.get(key) || [];
    const registeredShortcut: RegisteredShortcut = { action, priority };
    shortcuts.push(registeredShortcut);
    this.shortcuts.set(key, shortcuts);

    return () => {
      const activeShortcut = this.activeShortcut;
      if (activeShortcut && activeShortcut?.key === key) {
        if (activeShortcut.onRelease) {
          activeShortcut.onRelease();
        }
        this.activeShortcut = null;
      }
      const shortcuts = this.shortcuts.get(key);
      if (!shortcuts) {
        throw new Error(`Shortcut not registered: ${key}`);
      }
      const index = shortcuts.findIndex((s) => s.action === action);
      if (index === -1) {
        throw new Error(`Shortcut not registered: ${key}`);
      }
      shortcuts.splice(index, 1);
      if (shortcuts.length === 0) {
        this.shortcuts.delete(key);
      } else {
        this.shortcuts.set(key, shortcuts);
      }
    };
  }

  // Method to handle keydown event
  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.target && isTextAreaOrTextInput(event.target)) {
      return;
    }

    if (this.isPaused) {
      return;
    }

    // HAX: Prevent default for key events that likely interact with
    // browser elements. This is to avoid e.g. our application code
    // handling spacebar-to-pan and also inadvertently triggering a
    // button that is the activeElement.
    //
    // Why do we do this here? Because while it doesn't strictly relate
    // to our keyboard shortcut manager (we want this behavior even
    // when application code ad-hoc listens to spacebar, for example)
    // we don't want this logic when the keyboard shortcut manager is
    // paused or when a text input is focused, and those are handled
    // above.
    //
    // Why not prevent default on all key events?  That would disable
    // e.g. meta + R to refresh in the browser which we use for debugging.
    const normalizedCode = normalizeEventCode(event.code);
    if (
      normalizedCode === "space" ||
      normalizedCode === "enter" ||
      normalizedCode === "tab"
    ) {
      event.preventDefault();
    }

    const pressedKeys = new Set<NormalizedShortcutKey>();
    pressedKeys.add(normalizedKeyOrCode(event));

    if (event.metaKey) {
      pressedKeys.add("meta");
    }
    if (event.altKey) {
      pressedKeys.add("alt");
    }
    if (event.ctrlKey) {
      pressedKeys.add("control");
    }
    if (event.shiftKey) {
      pressedKeys.add("shift");
    }

    this.pressedKeys = pressedKeys;

    for (const [shortcutKey, registeredShortcuts] of this.shortcuts.entries()) {
      if (this.isShortcutPressed(shortcutKey, pressedKeys)) {
        // Find the highest priority shortcut (user-custom > default)
        const selectedShortcut =
          this.selectHighestPriorityShortcut(registeredShortcuts);

        if (
          this.activeShortcut?.registeredShortcut.action ===
            selectedShortcut.action &&
          this.activeShortcut.onRelease
        ) {
          // This shortcut performs an action on release; don't allow repeats.
          return;
        }

        // Clear active shortcut so that we can activate a new one
        if (this.activeShortcut) {
          if (this.activeShortcut.onRelease) {
            this.activeShortcut.onRelease();
          }
          this.activeShortcut = null;
        }

        event.preventDefault();

        this.activeShortcut = {
          key: shortcutKey,
          registeredShortcut: selectedShortcut,
          onRelease: selectedShortcut.action() || null,
        };
        break;
      }
    }
  };

  // WARNING
  //
  // Do not return early in this function until we've updated pressedKeys!
  private handleKeyUp = (event: KeyboardEvent) => {
    // The browser doesn't reliably notify when modifier keys are
    // released, so just clear all modifier keys when any key is
    // released.
    //
    // A special case of this is if *only* modifier keys are pressed,
    // in which case it's important that we don't clear the modifiers.
    //
    // This e.g. allows modifiers for the eye-dropper to be registered and
    // unregistered.
    //
    if (
      !Array.from(this.pressedKeys).every(
        (key) =>
          key === "meta" ||
          key === "alt" ||
          key === "control" ||
          key === "shift"
      )
    ) {
      // TODO(jlfwong): It's currently unclear what edge case these
      // delete calls help with.
      //
      // One weird bit of information: if you hold down Meta, and tap Z, you
      // don't get a keyup event for the z, but you do get a key up event for
      // the meta key.
      this.pressedKeys.delete("meta");
      this.pressedKeys.delete("alt");
      this.pressedKeys.delete("control");
      this.pressedKeys.delete("shift");
    }

    // Also remove the key that was released.
    this.pressedKeys.delete(normalizedKeyOrCode(event));

    if (this.isPaused) {
      return;
    }

    if (!this.activeShortcut) {
      return;
    }

    // If the shortcut is no longer pressed, release it.
    if (!this.isShortcutPressed(this.activeShortcut.key, this.pressedKeys)) {
      event.preventDefault();
      if (this.activeShortcut.onRelease) {
        this.activeShortcut.onRelease();
      }
      this.activeShortcut = null;
    }
  };

  private handleWindowBlur = () => {
    this.pressedKeys.clear();
    if (this.activeShortcut && this.activeShortcut.onRelease) {
      this.activeShortcut.onRelease();
    }
    this.activeShortcut = null;
  };

  private selectHighestPriorityShortcut(
    shortcuts: RegisteredShortcut[]
  ): RegisteredShortcut {
    // First, try to find a user-custom shortcut
    const userCustomShortcut = shortcuts.find(
      (s) => s.priority === "user-custom"
    );
    if (userCustomShortcut) {
      return userCustomShortcut;
    }

    // Otherwise, return the most recently registered default shortcut
    const defaultShortcuts = shortcuts.filter((s) => s.priority === "default");
    return (
      defaultShortcuts[defaultShortcuts.length - 1] ||
      shortcuts[shortcuts.length - 1]!
    );
  }

  private isShortcutPressed(
    shortcut: string,
    pressedKeys: Set<string>
  ): boolean {
    const required = new Set(shortcut.split(" "));

    // 1) All required keys must be present.
    for (const k of required) {
      if (!pressedKeys.has(k)) {
        return false;
      }
    }

    // 2) Disallow extras EXCEPT 'shift' when not explicitly required. This makes
    //    DigitN shortcuts work on layouts where you must hold Shift to get the
    //    numeral (e.g., AZERTY).
    for (const k of pressedKeys) {
      if (!required.has(k)) {
        if (!(k === "shift" && !required.has("shift"))) {
          return false;
        }
      }
    }
    return true;
  }
}

export const manager = new ShortcutManager();

export type ResolvedAction = {
  readonly name: string;
  readonly persistentId: string;
  readonly shortcuts: ReadonlyArray<ShortcutKeys>;
  readonly perform: ShortcutAction;
  readonly priority: ShortcutPriority;
};

export function registerKeyboardShortcut(
  keys: ShortcutKeys,
  callback: ShortcutAction,
  priority: ShortcutPriority = "default"
) {
  // Note: platform mapping is already done at APP_ACTIONS definition or in useShortcut
  return manager.registerShortcut(keys, callback, priority);
}

export function registerKeyboardShortcuts(
  actions: readonly {
    readonly shortcuts?: ReadonlyArray<ShortcutKeys>;
    readonly perform: ShortcutAction;
    readonly priority?: ShortcutPriority;
  }[]
): (() => void)[] {
  const unregisters: (() => void)[] = [];
  const platform = getPlatform();

  for (const { shortcuts, perform, priority = "default" } of actions) {
    if (!shortcuts) {
      continue;
    }

    for (const shortcut of shortcuts) {
      // Apply platform mapping here for consistency
      const mappedShortcut = mapShortcutKeysToPlatform(shortcut, platform);
      unregisters.push(
        registerKeyboardShortcut(mappedShortcut, perform, priority)
      );
    }
  }
  return unregisters;
}

export function useShortcut(
  keys: ShortcutKeys,
  callback: ShortcutAction,
  deps: DependencyList,
  priority: ShortcutPriority = "default"
) {
  useEffect(() => {
    // Apply platform mapping for React component shortcuts
    const platform = getPlatform();
    const mappedKeys = mapShortcutKeysToPlatform(keys, platform);
    return registerKeyboardShortcut(mappedKeys, callback, priority);
  }, deps);
}
