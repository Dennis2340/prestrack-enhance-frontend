import Link from "next/link";
import { ReactNode } from "react";
import { LayoutGrid, Users, MessageSquare, Pill, AlertTriangle, Shield } from "lucide-react";

// Simple cn util fallback if not present
function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/patients", label: "Patients", icon: Users },
  { href: "/dashboard/visitors", label: "Visitors", icon: Users },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/test", label: "Test", icon: MessageSquare },
  { href: "/dashboard/medications", label: "Medications", icon: Pill },
  { href: "/dashboard/escalations", label: "Escalations", icon: AlertTriangle },
  { href: "/dashboard/admin", label: "Admin", icon: Shield },
  // Admin utilities
  { href: "/dashboard/admin/providers", label: "Care Providers", icon: Users },
  { href: "/dashboard/admin/rag", label: "RAG Ingestion", icon: Shield },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // usePathname is client-only; we can highlight links based on "startsWith" on server by comparing via string
  // Here we keep it simple: highlight using startsWith via window path isn't available server-side, leaving neutral styles
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex md:flex-col">
          <div className="px-5 py-4 text-lg font-semibold border-b border-gray-200">Dashboard</div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "group flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 hover:text-teal-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 text-xs text-gray-500 border-t border-gray-200">AI & WhatsApp Healthcare</div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col">
          {/* Topbar */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="md:hidden">
              <span className="text-sm text-gray-500">Menu</span>
            </div>
            <div className="font-medium">Care Platform</div>
            <div className="text-sm text-gray-500">Admin</div>
          </div>

          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
