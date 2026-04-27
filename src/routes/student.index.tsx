import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ScanLine, Plus, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/student/")({
  component: StudentDashboard,
});

interface CourseRow { id: string; code: string; name: string; description: string | null; }
interface AttendanceRow {
  id: string;
  scanned_at: string;
  sessions: { topic: string; courses: { code: string; name: string } | null } | null;
}

function StudentDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    if (role && role !== "student") { navigate({ to: "/lecturer" }); return; }
    void loadAll();
  }, [authLoading, user, role]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: enrolls } = await supabase
      .from("enrollments")
      .select("course_id, courses(id, code, name, description)")
      .eq("student_id", user.id);
    setCourses(((enrolls ?? []).map((r) => r.courses).filter(Boolean) as CourseRow[]));

    const { data: att } = await supabase
      .from("attendance")
      .select("id, scanned_at, sessions(topic, courses(code, name))")
      .eq("student_id", user.id)
      .order("scanned_at", { ascending: false })
      .limit(50);
    setHistory((att ?? []) as unknown as AttendanceRow[]);
    setLoading(false);
  };

  const enroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = z.string().trim().min(2).max(20).safeParse(code);
    if (!trimmed.success) { toast.error("Invalid code"); return; }
    const { data: courseId, error: lookupErr } = await supabase
      .rpc("find_course_by_code", { _code: trimmed.data });
    if (lookupErr || !courseId) { toast.error("Course not found"); return; }
    const { error } = await supabase.from("enrollments").insert({
      course_id: courseId as string,
      student_id: user.id,
    });
    if (error) {
      if (error.code === "23505") toast.info("You're already enrolled");
      else toast.error(error.message);
    } else {
      toast.success("Enrolled!");
      setOpen(false);
      setCode("");
      await loadAll();
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
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-medium text-primary mb-1">Student dashboard</p>
            <h1 className="font-display text-4xl font-bold">Mark your attendance</h1>
            <p className="text-muted-foreground mt-1">Scan a lecturer's QR code or review your history below.</p>
          </div>
          <Link
            to="/student/scan"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.02] transition-smooth"
          >
            <ScanLine className="w-5 h-5" /> Open scanner
          </Link>
        </div>

        {/* Enrolled courses */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">My courses</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" /> Join course</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Join a course</DialogTitle></DialogHeader>
                <form onSubmit={enroll} className="space-y-4">
                  <div>
                    <Label htmlFor="code">Course code</Label>
                    <Input id="code" placeholder="CSC 401" value={code}
                      onChange={(e) => setCode(e.target.value)} required />
                    <p className="text-xs text-muted-foreground mt-1">Ask your lecturer for the course code.</p>
                  </div>
                  <Button type="submit" className="w-full">Enroll</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {courses.length === 0 ? (
            <div className="bg-gradient-card rounded-2xl border border-border p-10 text-center shadow-soft">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No courses yet. Join one with a course code from your lecturer.</p>
              <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Join course</Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((c) => (
                <div key={c.id} className="bg-gradient-card rounded-2xl border border-border p-5 shadow-soft">
                  <span className="text-xs font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground">{c.code}</span>
                  <h3 className="font-display font-semibold mt-3">{c.name}</h3>
                  {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <h2 className="font-display text-xl font-semibold mb-4">Recent attendance</h2>
          {history.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-10 text-center text-muted-foreground">
              No attendance recorded yet.
            </div>
          ) : (
            <ul className="bg-card rounded-2xl border border-border divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {h.sessions?.courses?.code} — {h.sessions?.topic}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{h.sessions?.courses?.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(h.scanned_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
