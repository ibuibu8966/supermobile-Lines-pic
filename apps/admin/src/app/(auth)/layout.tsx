import { getSession } from "@/lib/auth/cached-session";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { Sidebar, MobileMenuButton } from "@/components/sidebar/sidebar";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar user={session?.user} />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center gap-3">
            <MobileMenuButton />
            <h1 className="font-bold text-gray-900 text-sm">スーパー回線管理くん</h1>
          </header>
          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
