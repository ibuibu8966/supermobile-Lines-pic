"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isCollapsed: boolean;
  isActive: boolean;
}

export function SidebarItem({
  href,
  icon: Icon,
  label,
  isCollapsed,
  isActive,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
        ${isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }
        ${isCollapsed ? "justify-center" : ""}
      `}
      title={isCollapsed ? label : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!isCollapsed && (
        <span className="truncate text-sm">{label}</span>
      )}
    </Link>
  );
}
