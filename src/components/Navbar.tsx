import { Link, useNavigate } from "@tanstack/react-router";
import { ScanLine, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const dashLink = role === "lecturer" ? "/lecturer" : "/student";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow group-hover:scale-105 transition-smooth">
            <ScanLine className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">ScanMark</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to={dashLink}
                className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-smooth"
              >
                Dashboard
              </Link>
              <span className="hidden md:inline text-sm text-muted-foreground mr-2">
                {profile?.full_name || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-smooth"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-smooth shadow-soft"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
