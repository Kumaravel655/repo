"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MessageSquare,
  LayoutDashboard,
  Radio,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
} from "lucide-react"
import { apiRequest, clearAuthSession, getAccessToken, getStoredUser, setStoredUser, type AuthUser } from "@/lib/api"

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Channels", href: "/dashboard/channels", icon: Radio },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

const adminNavigation = [{ name: "Admin", href: "/dashboard/admin", icon: ShieldCheck }]

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState("User")
  const [userEmail, setUserEmail] = useState("user@example.com")
  const [isAdmin, setIsAdmin] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const navigation = isAdmin ? [...baseNavigation, ...adminNavigation] : baseNavigation

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U"

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      router.replace("/login")
      return
    }

    const user = getStoredUser()
    if (user) {
      setUserName(user.name || "User")
      setUserEmail(user.email)
      setIsAdmin(!!user.isAdmin)
    }
    setIsReady(true)

    let mounted = true

    async function syncCurrentUser() {
      try {
        const payload = await apiRequest<{ success: boolean; user: AuthUser }>("/api/auth/me")
        if (!mounted) {
          return
        }

        setUserName(payload.user.name || "User")
        setUserEmail(payload.user.email)
        setIsAdmin(!!payload.user.isAdmin)
        setStoredUser(payload.user)
      } catch {
        if (!mounted) {
          return
        }
        clearAuthSession()
        router.replace("/login")
      }
    }

    syncCurrentUser()

    return () => {
      mounted = false
    }
  }, [router])

  function handleLogout() {
    clearAuthSession()
    router.push("/login")
  }

  if (!isReady) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">BotForge</span>
          </Link>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="mt-8">
            <Button asChild className="w-full gap-2">
              <Link href="/dashboard/channels/new">
                <Plus className="h-4 w-4" />
                New Channel
              </Link>
            </Button>
          </div>
        </div>

      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-foreground">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <span className="flex items-center">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
