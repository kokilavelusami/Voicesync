import { Link, useLocation } from "react-router-dom";
import { Mic, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const Header = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Generate", icon: Mic },
  ];

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="VoiceSync logo" className="w-8 h-8 rounded-md" />
          <span className="font-bold text-lg gradient-text">VoiceSync</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.pathname === to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="w-4 h-4" />
            <span className="max-w-[140px] truncate">{user?.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
