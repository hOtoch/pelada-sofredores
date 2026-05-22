import type { ReactNode } from "react";

import "./profile-portal.css";

interface ProfileStatCardProps {
  label: string;
  value: string;
  helperText?: string;
  accent?: "primary" | "positive" | "warning";
  icon?: ReactNode;
}

export function ProfileStatCard({
  label,
  value,
  helperText,
  accent = "primary",
  icon,
}: ProfileStatCardProps) {
  return (
    <article className={`glass-card common-profile-stat common-profile-stat--${accent}`}>
      <header className="common-profile-stat__header">
        <span>{label}</span>
        {icon ? <span className="common-profile-stat__icon">{icon}</span> : null}
      </header>
      <strong className="common-profile-stat__value">{value}</strong>
      {helperText ? <small className="common-profile-stat__helper">{helperText}</small> : null}
    </article>
  );
}
