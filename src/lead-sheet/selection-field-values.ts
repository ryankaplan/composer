import { MelodyEvent } from "./types";

/**
 * Gets the unique set of values for a specific field across selected note/rest events.
 */
export function getSelectedFieldValues<T>(
  events: MelodyEvent[],
  selection: { start: number; end: number } | null,
  getValue: (event: MelodyEvent & { kind: "note" | "rest" }) => T,
  getKey?: (value: T) => string
): T[] {
  if (!selection) {
    return [];
  }

  const values: T[] = [];
  const keys = new Set<string>();

  for (let i = selection.start; i < selection.end; i++) {
    const event = events[i];
    if (event && (event.kind === "note" || event.kind === "rest")) {
      const val = getValue(event as MelodyEvent & { kind: "note" | "rest" });
      const key = getKey ? getKey(val) : String(val);

      if (!keys.has(key)) {
        keys.add(key);
        values.push(val);
      }
    }
  }

  return values;
}

