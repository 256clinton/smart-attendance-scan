import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, BookOpen, Users, Calendar, Loader2 } from "lucide-react";
import { z } from "zod";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/lecturer/")({
  component: LecturerDashboard,
});

interface Course {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
}

const courseSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
});

function LecturerDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (role && role !== "lecturer") {
      navigate({ to: "/student" });
      return;
    }
    void loadCourses();
  }, [authLoading, user, role]);

  const loadCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setCourses(data ?? []);
    setLoading(false);
  };

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsed = courseSchema.parse(form);
      const { error } = await supabase.from("courses").insert({
        lecturer_id: user.id,
        code: parsed.code,
        name: parsed.name,
        description: parsed.description || null,
      });
      if (error) throw error;
      toast.success("Course created");
      setOpen(false);
      setForm({ code: "", name: "", description: "" });
      await loadCourses();
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-medium text-primary mb-1">Lecturer dashboard</p>
            <h1 className="font-display text-4xl font-bold">Your courses</h1>
            <p className="text-muted-foreground mt-1">Create courses and generate QR codes for each session.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-soft">
                <Plus className="w-4 h-4 mr-2" /> New course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a course</DialogTitle>
              </DialogHeader>
              <form onSubmit={createCourse} className="space-y-4">
                <div>
                  <Label htmlFor="code">Course code</Label>
                  <Input id="code" placeholder="CSC 401" value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="name">Course name</Label>
                  <Input id="name" placeholder="Distributed Systems" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="desc">Description (optional)</Label>
                  <Textarea id="desc" rows={3} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Creating..." : "Create course"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {courses.length === 0 ? (
          <div className="bg-gradient-card rounded-2xl border border-border shadow-soft p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold mb-1">No courses yet</h3>
            <p className="text-muted-foreground mb-6">Create your first course to start tracking attendance.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New course
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => (
              <Link
                key={c.id}
                to="/lecturer/course/$courseId"
                params={{ courseId: c.id }}
                className="group bg-gradient-card rounded-2xl border border-border p-6 shadow-soft hover:shadow-glow hover:-translate-y-0.5 transition-smooth"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-smooth">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground">
                    {c.code}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold mb-1 line-clamp-1">{c.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {c.description || "No description"}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Manage</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Sessions</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
