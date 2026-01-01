import React from "react";

type NoteIconProps = {
  size?: number;
  color?: string;
};

export function QuarterNoteIcon({
  size = 20,
  color = "currentColor",
}: NoteIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.35817 14.9739C9.9151 14.4072 10.8327 13.0012 10.4077 11.8335C9.98269 10.6658 8.37601 10.1786 6.81908 10.7453C5.26214 11.312 4.34454 12.718 4.76955 13.8857C5.19455 15.0534 6.80123 15.5406 8.35817 14.9739Z"
        fill="black"
      />
      <path
        d="M10.5 3.29047L10.5081 12.5541L9.5081 12.555L9.5 3.29134L10.5 3.29047Z"
        fill="black"
      />
    </svg>
  );
}

export function EighthNoteIcon({
  size = 20,
  color = "currentColor",
}: NoteIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.35817 14.9739C9.9151 14.4072 10.8327 13.0012 10.4077 11.8335C9.98269 10.6658 8.37601 10.1786 6.81908 10.7453C5.26214 11.3119 4.34454 12.7179 4.76955 13.8856C5.19455 15.0533 6.80123 15.5406 8.35817 14.9739Z"
        fill="black"
      />
      <path
        d="M10.5 4.74429L10.5081 12.5539L9.5081 12.5549L9.5 4.74533L10.5 4.74429Z"
        fill="black"
      />
      <path
        d="M13.1445 5.35718V7.33667L9.50879 4.97437L9.5332 2.9187L13.1445 5.35718Z"
        fill="black"
      />
    </svg>
  );
}

export function SixteenthNoteIcon({
  size = 20,
  color = "currentColor",
}: NoteIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.35817 14.9739C9.9151 14.4072 10.8327 13.0012 10.4077 11.8335C9.98269 10.6658 8.37601 10.1786 6.81908 10.7453C5.26214 11.3119 4.34454 12.7179 4.76955 13.8856C5.19455 15.0533 6.80123 15.5406 8.35817 14.9739Z"
        fill="black"
      />
      <path
        d="M10.5 4.74429L10.5081 12.5539L9.5081 12.5549L9.5 4.74533L10.5 4.74429Z"
        fill="black"
      />
      <path
        d="M13.1445 5.35718V7.33667L9.50879 4.97437L9.5332 2.9187L13.1445 5.35718Z"
        fill="black"
      />
      <path
        d="M13.1445 8.1701V9.35175L9.50879 6.98944L9.5332 5.73163L13.1445 8.1701Z"
        fill="black"
      />
    </svg>
  );
}
