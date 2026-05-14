import { FC } from "react";

interface Props {
  src?: string;
  label: string;
  size?: number;
  variant?: "gradient" | "green";
}

export const HexLogo: FC<Props> = ({ src, label, size = 56, variant = "gradient" }) => (
  <div className="hex-frame" style={{ width: size, height: size }}>
    <div className={"hex-frame-border " + variant} />
    <div className="hex-frame-inner">
      {src ? (
        <img src={src} alt={label} />
      ) : (
        <span className="hex-frame-label" style={{ fontSize: size * 0.22 }}>
          {label.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  </div>
);
