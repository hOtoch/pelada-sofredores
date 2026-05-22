import type { ReactNode } from "react";

import "./profile-portal.css";

interface TimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  rightBadge?: string;
  meta?: string;
}

interface ProfileTimelineListProps {
  title: string;
  emptyMessage: string;
  items: TimelineItem[];
  icon?: ReactNode;
}

export function ProfileTimelineList({
  title,
  emptyMessage,
  items,
  icon,
}: ProfileTimelineListProps) {
  return (
    <section className="glass-card common-profile-section">
      <header className="common-profile-section__header">
        <h3>{title}</h3>
        {icon ? <span>{icon}</span> : null}
      </header>
      {items.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <ul className="common-profile-list">
          {items.map((item) => (
            <li key={item.id} className="common-profile-list__item">
              <div>
                <strong>{item.title}</strong>
                {item.subtitle ? <small>{item.subtitle}</small> : null}
              </div>
              <div className="common-profile-list__meta">
                {item.rightBadge ? (
                  <span className="common-profile-list__badge">{item.rightBadge}</span>
                ) : null}
                {item.meta ? <small>{item.meta}</small> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
