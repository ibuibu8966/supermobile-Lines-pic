"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Smartphone,
  Tags,
  Settings,
  Package,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  ListChecks,
  Archive,
  Ticket,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { SidebarItem } from "./sidebar-item";

interface SidebarProps {
  user?: {
    email?: string | null;
    role?: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "顧客",
  ADMIN: "管理者",
  SUPER_ADMIN: "スーパー管理者",
};

const menuItems = [
  { title: "ダッシュボード", href: "/", icon: LayoutDashboard, superAdminOnly: true },
  { title: "申込管理", href: "/applications", icon: FileText },

  { title: "総合回線管理", href: "/lines", icon: ListChecks, superAdminOnly: true },
  { title: "SIM管理", href: "/sims", icon: Smartphone, superAdminOnly: true },
  { title: "仕入れ(支出)管理", href: "/procurement", icon: ShoppingCart, superAdminOnly: true },
  { title: "損益管理", href: "/profit-loss", icon: TrendingUp, superAdminOnly: true },
  { title: "タグ管理", href: "/tags", icon: Tags, superAdminOnly: true },
  { title: "サービス・プラン管理", href: "/services", icon: Package, superAdminOnly: true },
  { title: "クーポン管理", href: "/coupons", icon: Ticket, superAdminOnly: true },
  { title: "ユーザー管理", href: "/users", icon: Users },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebar();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const filteredMenuItems = menuItems.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`p-4 border-b ${isCollapsed ? "px-2" : ""}`}>
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-gray-900 text-sm">スーパー回線管理くん</h1>
              <p className="text-xs text-gray-500">SIM統合管理システム</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="hidden lg:flex h-8 w-8"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredMenuItems.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.title}
            isCollapsed={isCollapsed}
            isActive={isActive(item.href)}
          />
        ))}
      </nav>

      {/* User section */}
      <div className={`border-t p-4 ${isCollapsed ? "px-2" : ""}`}>
        {user && (
          <div className={`${isCollapsed ? "flex flex-col items-center gap-2" : "space-y-3"}`}>
            {!isCollapsed && (
              <div className="text-sm">
                <p className="text-gray-600 truncate">{user.email}</p>
                {user.role && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    {ROLE_LABELS[user.role] || user.role}
                  </Badge>
                )}
              </div>
            )}
            <Button
              variant="outline"
              size={isCollapsed ? "icon" : "sm"}
              onClick={handleLogout}
              className={isCollapsed ? "h-8 w-8" : "w-full"}
              title={isCollapsed ? "ログアウト" : undefined}
            >
              <LogOut className={`h-4 w-4 ${isCollapsed ? "" : "mr-2"}`} />
              {!isCollapsed && "ログアウト"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col bg-white border-r transition-all duration-300 sticky top-0 h-screen
          ${isCollapsed ? "w-16" : "w-64"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 lg:hidden
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={closeMobile}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}

export function MobileMenuButton() {
  const { toggleMobile } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMobile}
      className="lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
