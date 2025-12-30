// ShortcutKey represents user-facing shortcut definitions.
// Letters are simple lowercase 'a'-'z' for readability.
// At runtime, these are normalized to NormalizedShortcutKey.
export type ShortcutKey =
  // Letter keys are lower-case version of event.key
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"

  // Everything else is lower-case version of event.code with the following
  // modifications...
  //  - shiftleft, shiftright -> shift
  //  - controlleft, controlright -> control
  //  - altleft, altright -> alt
  //  - metaleft, metaright -> meta
  | "meta"
  | "shift"
  | "control"
  | "alt"
  | "escape"
  | "enter"
  | "backspace"
  | "delete"
  | "comma"
  | "period"
  | "tab"
  | "space"
  | "arrowup"
  | "arrowdown"
  | "arrowleft"
  | "arrowright"
  | "bracketleft"
  | "bracketright"
  | "backquote"
  | "slash"
  | "backslash"
  | "equal"
  | "minus"
  | "digit0"
  | "digit1"
  | "digit2"
  | "digit3"
  | "digit4"
  | "digit5"
  | "digit6"
  | "digit7"
  | "digit8"
  | "digit9";

export type ShortcutKeys = ReadonlyArray<Readonly<ShortcutKey>>;

// Normalized keys are what ShortcutManager uses internally after normalization.
// Letters with Alt/Ctrl/Meta become 'keyx' format (position-based) to avoid
// international layout issues where Alt+G produces special characters.
export type NormalizedShortcutKey =
  | ShortcutKey
  | "keya"
  | "keyb"
  | "keyc"
  | "keyd"
  | "keye"
  | "keyf"
  | "keyg"
  | "keyh"
  | "keyi"
  | "keyj"
  | "keyk"
  | "keyl"
  | "keym"
  | "keyn"
  | "keyo"
  | "keyp"
  | "keyq"
  | "keyr"
  | "keys"
  | "keyt"
  | "keyu"
  | "keyv"
  | "keyw"
  | "keyx"
  | "keyy"
  | "keyz";

export type NormalizedShortcutKeys = ReadonlyArray<
  Readonly<NormalizedShortcutKey>
>;
