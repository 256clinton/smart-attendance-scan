import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, QrCode, Loader2, Users, Clock, Copy, CheckCircle2 } from "lucide-react";
import QRCode from "qrcode";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/lecturer/course/$courseId")({
  component: CourseDetail,
});

interface Course { id: string; code: string; name: string; description: string | null; }
interface SessionRow {
  id: string;
  topic: string;
  scan_token: string;
  starts_at: string;
  expires_at: string;
}
interface AttendanceRow {
  id: string;
  scanned_at: string;
  student_id: string;
  session_id: string;
  profiles?: { full_name: string; university_id: string | null } | null;
}
interface EnrollmentRow {
  id: string;
  student_id: string;
  profiles?: { full_name: string; university_id: string | null } | null;
}

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(15);
  const [activeQr, setActiveQr] = useState<{ session: SessionRow; dataUrl: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    if (role && role !== "lecturer") { navigate({ to: "/student" }); return; }
    void loadAll();
  }, [authLoading, user, role, courseId]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: c }, { data: s }, { data: e }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("sessions").select("*").eq("course_id", courseId).order("starts_at", { ascending: false }),
      supabase.from("enrollments").select("id, student_id").eq("course_id", courseId),
    ]);
    setCourse(c ?? null);
    const sessionsData = (s ?? []) as SessionRow[];
    setSessions(sessionsData);

    const sessionIds = sessionsData.map((x) => x.id);
    const { data: a } = sessionIds.length
      ? await supabase
          .from("attendance")
          .select("id, scanned_at, student_id, session_id")
          .in("session_id", sessionIds)
          .order("scanned_at", { ascending: false })
      : { data: [] as { id: string; scanned_at: string; student_id: string; session_id: string }[] };

    const enrollmentsData = (e ?? []) as { id: string; student_id: string }[];
    const studentIds = Array.from(
      new Set([...(a ?? []).map((r) => r.student_id), ...enrollmentsData.map((r) => r.student_id)])
    );
    const { data: profs } = studentIds.length
      ? await supabase.from("profiles").select("id, full_name, university_id").in("id", studentIds)
      : { data: [] as { id: string; full_name: string; university_id: string | null }[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    setAttendance(
      (a ?? []).map((row) => ({
        ...row,
        profiles: profMap.get(row.student_id)
          ? {
              full_name: profMap.get(row.student_id)!.full_name,
              university_id: profMap.get(row.student_id)!.university_id,
            }
          : null,
      }))
    );
    setEnrollments(
      enrollmentsData.map((row) => ({
        ...row,
        profiles: profMap.get(row.student_id)
          ? {
              full_name: profMap.get(row.student_id)!.full_name,
              university_id: profMap.get(row.student_id)!.university_id,
            }
          : null,
      }))
    );
    setLoading(false);
  };

  const startSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const expires = new Date(Date.now() + duration * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        course_id: courseId,
        lecturer_id: user.id,
        topic: topic.trim() || "Lecture",
        expires_at: expires,
      })
      .select()
      .single();
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    toast.success("Session started");
    setOpen(false);
    setTopic("");
    await loadAll();
    void showQr(data);
  };

  const showQr = async (s: SessionRow) => {
    const url = `${window.location.origin}/student/scan?token=${s.scan_token}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#1b1340", light: "#ffffff" } });
    setActiveQr({ session: s, dataUrl });
  };

  const attendanceBySession = useMemo(() => {
    const map: Record<string, AttendanceRow[]> = {};
    for (const a of attendance) {
      (map[a.session_id] ??= []).push(a);
    }
    return map;
  }, [attendance]);

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

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-muted-foreground">Course not found.</p>
          <Link to="/lecturer" className="text-primary font-medium">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/lecturer" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to courses
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground">{course.code}</span>
            <h1 className="font-display text-4xl font-bold mt-3">{course.name}</h1>
            {course.description && <p className="text-muted-foreground mt-2 max-w-2xl">{course.description}</p>}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-glow">
                <QrCode className="w-4 h-4 mr-2" /> Start session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Start a new session</DialogTitle></DialogHeader>
              <form onSubmit={startSession} className="space-y-4">
                <div>
                  <Label htmlFor="topic">Topic</Label>
                  <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Consensus Algorithms" />
                </div>
                <div>
                  <Label htmlFor="dur">Active for (minutes)</Label>
                  <Input id="dur" type="number" min={1} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
                <Button type="submit" className="w-full">Generate QR & start</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
            <TabsTrigger value="students">Students ({enrollments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-6">
            {sessions.length === 0 ? (
              <div className="bg-gradient-card rounded-2xl border border-border p-12 text-center shadow-soft">
                <p className="text-muted-foreground">No sessions yet. Start your first session to generate a QR code.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((s) => {
                  const isActive = new Date(s.expires_at) > new Date();
                  const att = attendanceBySession[s.id] ?? [];
                  return (
                    <div key={s.id} className="bg-gradient-card rounded-2xl border border-border p-6 shadow-soft">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-display text-lg font-semibold">{s.topic}</h3>
                            {isActive ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">Active</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Closed</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-3">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(s.starts_at).toLocaleString()} → expires {new Date(s.expires_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => showQr(s)}>
                            <QrCode className="w-4 h-4 mr-2" /> Show QR
                          </Button>
                        </div>
                      </div>
                      <div className="border-t border-border pt-3">
                        <p className="text-sm font-medium mb-2">{att.length} student{att.length === 1 ? "" : "s"} checked in</p>
                        {att.length > 0 && (
                          <ul className="grid sm:grid-cols-2 gap-2">
                            {att.map((a) => (
                              <li key={a.id} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                <span className="truncate">
                                  {a.profiles?.full_name || "Student"}
                                  {a.profiles?.university_id && (
                                    <span className="text-muted-foreground"> · {a.profiles.university_id}</span>
                                  )}
                                </span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {new Date(a.scanned_at).toLocaleTimeString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <div className="bg-gradient-card rounded-2xl border border-border p-6 shadow-soft mb-4">
              <h3 className="font-semibold mb-2">Course code</h3>
              <p className="text-sm text-muted-foreground mb-3">Share this code with your students so they can enroll from their dashboard.</p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-3">
                <code className="font-mono font-semibold flex-1">{course.code}</code>
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(course.code); toast.success("Copied"); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {enrollments.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-10 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No students enrolled yet.
              </div>
            ) : (
              <ul className="bg-card rounded-2xl border border-border divide-y divide-border">
                {enrollments.map((en) => (
                  <li key={en.id} className="px-5 py-3 flex items-center justify-between">
                    <span className="font-medium">{en.profiles?.full_name || "Student"}</span>
                    <span className="text-sm text-muted-foreground">{en.profiles?.university_id}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* QR Modal */}
      <Dialog open={!!activeQr} onOpenChange={(v) => !v && setActiveQr(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{activeQr?.session.topic}</DialogTitle></DialogHeader>
          {activeQr && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
                <img src={activeQr.dataUrl} alt="QR code" className="w-full max-w-[360px]" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Active until {new Date(activeQr.session.expires_at).toLocaleTimeString()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
