"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/admin/applications", label: "申し込み一覧", match: "/admin/applications" },
  { href: "/admin/applications/archived", label: "アーカイブ", exact: true },
  { href: "/admin/lines", label: "総合回線管理" },
  { href: "/admin/tags", label: "タグ管理" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.exact) return pathname === item.href;
    if (item.match) return pathname.startsWith(item.match) && pathname !== "/admin/applications/archived";
    return pathname.startsWith(item.href);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col text-gray-900">
      <header className="bg-gray-800 shadow-md">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-white">
                物販管理画面
              </h1>
              <nav className="flex space-x-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive(item)
                        ? "bg-gray-900 text-white"
                        : "text-gray-300 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
