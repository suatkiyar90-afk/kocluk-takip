"use client";

import { useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export interface BottomTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | "dot";
  badgeSrText?: string;
  panelId?: string;
  tabId?: string;
}

interface BottomTabBarProps {
  items: BottomTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export function BottomTabBar({
  items,
  activeId,
  onSelect,
  ariaLabel,
  className = "",
}: BottomTabBarProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex = -1;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }
    if (nextIndex < 0) return;
    event.preventDefault();
    onSelect(items[nextIndex].id);
    refs.current[nextIndex]?.focus();
  }

  return (
    <nav
      aria-label={ariaLabel}
      role="tablist"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur print:hidden ${className}`}
    >
      <ul className="grid grid-cols-6">
        {items.map((item, index) => {
          const active = item.id === activeId;
          const Icon = item.icon;
          const badgeCount =
            typeof item.badge === "number" ? formatBadgeCount(item.badge) : null;
          const showDot = item.badge === "dot";
          const showCount = badgeCount !== null;
          return (
            <li key={item.id}>
              <button
                ref={(el) => {
                  refs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={item.tabId}
                aria-selected={active}
                aria-controls={item.panelId}
                tabIndex={active ? 0 : -1}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-center transition touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                  active ? "text-indigo-600" : "text-gray-500"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`h-5 w-5 ${active ? "stroke-2" : "stroke-1"}`}
                />
                <span className="w-full truncate text-[10px] font-bold leading-tight">
                  {item.label}
                </span>
                {showDot ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
                    />
                    <span className="sr-only">{item.badgeSrText}</span>
                  </>
                ) : null}
                {showCount ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute right-1 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white"
                    >
                      {badgeCount}
                    </span>
                    <span className="sr-only">{item.badgeSrText}</span>
                  </>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
