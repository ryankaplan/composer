import React from "react";

type IconProps = {
  name: string;
  familyOverride?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
};

function getIconClassName(iconName: string, familyOverride?: string): string {
  const family = familyOverride || "fas";
  return `${family} fa-${iconName}`;
}

export function FaIcon(props: IconProps) {
  const { name: iconName } = props;

  return (
    <i
      className={getIconClassName(iconName, props.familyOverride)}
      style={{
        width: `20px`,
        textAlign: "center",
        ...(props.style || {}),
      }}
      onClick={props.onClick}
      onPointerDown={props.onPointerDown}
      onPointerUp={props.onPointerUp}
    ></i>
  );
}
