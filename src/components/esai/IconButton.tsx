import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label?: string;
  active?: boolean;
};

export function IconButton({ icon, label, active = false, className = "", ...props }: IconButtonProps) {
  return (
    <button className={`icon-button ${active ? "active" : ""} ${className}`} {...props}>
      {icon}
      {label ? <span>{label}</span> : null}
    </button>
  );
}

