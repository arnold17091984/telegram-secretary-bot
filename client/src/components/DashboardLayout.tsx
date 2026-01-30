import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  CheckSquare,
  Calendar,
  FileText,
  Settings,
  Zap,
  ScrollText,
  Bell,
  CalendarDays,
  Repeat,
  CheckCircle2,
  Building2,
  CreditCard,
  Bot,
  Sparkles,
  Sun,
  Moon
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "./ui/button";

// User menu items
const userMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Building2, label: "Organizations", path: "/organizations" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
  { icon: Zap, label: "Triggers", path: "/triggers" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: CreditCard, label: "Billing", path: "/billing" },
];

// Admin menu items
const adminMenuItems = [
  { icon: CheckSquare, label: "Tasks", path: "/tasks" },
  { icon: Repeat, label: "Recurring", path: "/recurring-tasks" },
  { icon: CheckCircle2, label: "Completions", path: "/task-completions" },
  { icon: Calendar, label: "Meetings", path: "/meetings" },
  { icon: Bell, label: "Reminders", path: "/reminders" },
  { icon: FileText, label: "Drafts", path: "/drafts" },
  { icon: ScrollText, label: "Audit Logs", path: "/audit-logs" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayoutInternal>{children}</DashboardLayoutInternal>;
}

export default function DashboardLayoutInternal({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return <DevLoginScreen />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const allMenuItems = [...userMenuItems, ...(user?.role === 'admin' ? adminMenuItems : [])];
  const activeMenuItem = allMenuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-primary/10 bg-sidebar"
          disableTransition={isResizing}
        >
          {/* Logo Header */}
          <SidebarHeader className="h-16 justify-center border-b border-primary/10">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-primary/10 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 group"
                aria-label="Toggle navigation"
              >
                <div className="relative">
                  <Bot className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                  <div className="absolute inset-0 bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight text-foreground">
                    Neural<span className="text-primary">Secretary</span>
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-4">
            <SidebarMenu className="px-2 space-y-1">
              {/* User menu items */}
              {userMenuItems.map((item, index) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all duration-200 font-normal rounded-lg group
                        ${isActive
                          ? "bg-primary/15 text-primary border border-primary/20 shadow-glow-sm"
                          : "hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                        }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <item.icon
                        className={`h-4 w-4 transition-all duration-200
                          ${isActive ? "text-primary" : "group-hover:text-primary"}`}
                      />
                      <span className="font-medium">{item.label}</span>
                      {isActive && (
                        <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Admin menu items */}
              {user?.role === 'admin' && (
                <>
                  <div className="px-3 py-3 mt-4">
                    <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest">
                      Admin Console
                    </span>
                  </div>
                  {adminMenuItems.map((item, index) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all duration-200 font-normal rounded-lg group
                            ${isActive
                              ? "bg-primary/15 text-primary border border-primary/20 shadow-glow-sm"
                              : "hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          <item.icon
                            className={`h-4 w-4 transition-all duration-200
                              ${isActive ? "text-primary" : "group-hover:text-primary"}`}
                          />
                          <span className="font-medium">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-primary/10">
            <ThemeToggleButton />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-primary/5 transition-all duration-200 w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group">
                  <Avatar className="h-8 w-8 border border-primary/20 shrink-0 ring-2 ring-primary/10 ring-offset-2 ring-offset-sidebar">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-primary/20">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-all duration-200
            ${isCollapsed ? "hidden" : "hover:bg-primary/30 hover:shadow-glow-sm"}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {/* Mobile header */}
        {isMobile && (
          <div className="flex border-b border-primary/10 h-14 items-center justify-between bg-background/80 px-4 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary" />
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">
                  {activeMenuItem?.label ?? "Menu"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main content area with grid pattern */}
        <main className="flex-1 p-6 grid-pattern noise-overlay min-h-screen">
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </SidebarInset>
    </>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme, switchable } = useTheme();
  if (!switchable || !toggleTheme) return null;

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-primary/5 transition-all duration-200 w-full text-left text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </span>
    </button>
  );
}

// Development login screen
function DevLoginScreen() {
  const loginUrl = getLoginUrl();
  const utils = trpc.useUtils();
  const devLoginMutation = trpc.auth.devLogin.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      window.location.reload();
    },
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-background grid-pattern noise-overlay">
      <div className="relative z-10 flex flex-col items-center gap-8 p-8 max-w-md w-full">
        {/* Glowing orb background effect */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />

        <div className="flex flex-col items-center gap-6 relative">
          {/* Logo with glow */}
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-glow">
              <Bot className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-emerald-400" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Neural<span className="text-gradient">Secretary</span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              {loginUrl
                ? "AI-powered task management for Telegram. Sign in to continue."
                : "Development Mode - OAuth not configured"}
            </p>
          </div>
        </div>

        {loginUrl ? (
          <Button
            onClick={() => {
              window.location.href = loginUrl;
            }}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-glow hover:shadow-glow transition-all duration-300"
          >
            Sign In
          </Button>
        ) : (
          <Button
            onClick={() => devLoginMutation.mutate({})}
            disabled={devLoginMutation.isPending}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-glow hover:shadow-glow transition-all duration-300"
          >
            {devLoginMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Connecting...
              </span>
            ) : (
              "Enter Dev Mode"
            )}
          </Button>
        )}

        {devLoginMutation.error && (
          <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">
            {devLoginMutation.error.message}
          </p>
        )}

        {/* Version info */}
        <p className="text-xs text-muted-foreground/50 font-mono">
          v1.0.0 // neural-core
        </p>
      </div>
    </div>
  );
}
