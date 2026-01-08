import Link from "next/link";
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { LayoutGrid, Users, MessageSquare, Pill, AlertTriangle, Shield } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

// Simple cn util fallback if not present
function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = { href: string; label: string; icon: any }
const NAV_ALL: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/patients", label: "Patients", icon: Users },
  { href: "/dashboard/visitors", label: "Visitors", icon: Users },
  { href: "/dashboard/test", label: "Test", icon: MessageSquare },
  { href: "/dashboard/medications", label: "Medications", icon: Pill },
  { href: "/dashboard/escalations", label: "Escalations", icon: AlertTriangle },
  { href: "/dashboard/admin", label: "Admin", icon: Shield },
  { href: "/dashboard/admin/providers", label: "Care Providers", icon: Users },
  { href: "/dashboard/admin/rag", label: "RAG Ingestion", icon: Shield },
]
//and for a patient we can even send message to that patient directly, add it please and see the previous conversation between the patients, and the ai please, hope we are storing it there, hope u understand? let add this there please
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Derive role from JWT in cookie (server component)
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_token")?.value || ""
  const payload = token ? verifyJwt<{ sub: string; role: "admin"|"provider"; email?: string | null }>(token) : null
  const role: "admin" | "provider" = (payload?.role === "admin" || payload?.role === "provider") ? payload!.role : "provider"
  const nav: NavItem[] = role === 'admin'
    ? NAV_ALL
    : NAV_ALL.filter(i => !i.href.startsWith('/dashboard/admin'))
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
          <div className="p-4 border-t border-gray-200">
            <LogoutButton />
            <div className="mt-2 text-xs text-gray-500">HOA Wellness Hub • Women's Health & AI Care</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col">
          {/* Topbar */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="md:hidden">
              <span className="text-sm text-gray-500">Menu</span>
            </div>
            <div className="flex items-center gap-2 font-semibold">
              <img src="/hoa-logo.jpeg" alt="HOA" className="h-5 w-5" />
              <span>HOA Wellness Hub</span>
            </div>
            <div className="text-sm text-gray-500 capitalize">{role}</div>
          </div>

          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
