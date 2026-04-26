import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name is too short").max(100),
  universityId: z.string().trim().min(2, "Required").max(50),
  email: z.string().trim().email().max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
  role: z.enum(["lecturer", "student"]),
});

const signinSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    universityId: "",
    email: "",
    password: "",
    role: "student" as "lecturer" | "student",
  });

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const parsed = signupSchema.parse(form);
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: parsed.fullName,
              university_id: parsed.universityId,
              role: parsed.role,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created! Redirecting...");
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: parsed.role === "lecturer" ? "/lecturer" : "/student" });
        } else {
          navigate({ to: "/auth" });
        }
      } else {
        const parsed = signinSchema.parse(form);
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        // Determine role to route
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: roleRow } = await supabase
            .from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
          navigate({ to: roleRow?.role === "lecturer" ? "/lecturer" : "/student" });
        }
      }
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-mesh flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow">
            <ScanLine className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-2xl">ScanMark</span>
        </Link>

        <div className="bg-card rounded-2xl border border-border shadow-card p-8">
          <h1 className="font-display text-2xl font-bold mb-1">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {isSignup ? "Join ScanMark in seconds." : "Sign in to your dashboard."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {isSignup && (
              <>
                <div>
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="universityId">University ID</Label>
                  <Input
                    id="universityId"
                    value={form.universityId}
                    onChange={(e) => setForm({ ...form, universityId: e.target.value })}
                    placeholder="STU-12345 or LEC-007"
                    required
                  />
                </div>
                <div>
                  <Label>I am a</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(["student", "lecturer"] as const).map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setForm({ ...form, role: r })}
                        className={`px-4 py-2.5 rounded-lg border font-medium text-sm capitalize transition-smooth ${
                          form.role === r
                            ? "bg-primary text-primary-foreground border-primary shadow-soft"
                            : "bg-background border-border hover:bg-muted"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@university.edu"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {isSignup ? "Already have an account? " : "New to ScanMark? "}
            <Link
              to="/auth"
              search={{ mode: isSignup ? "signin" : "signup" }}
              className="text-primary font-semibold hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
