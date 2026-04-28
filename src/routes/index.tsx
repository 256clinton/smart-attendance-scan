import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  ScanLine, 
  QrCode, 
  Users, 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  Clock 
} from "lucide-react";
import { useState, useEffect } from "react";

import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  loader: async () => {
    const now = new Date().toISOString();

    const { data: liveSessions, error } = await supabase
      .from("sessions")
      .select(`
        id,
        topic,
        expires_at,
        scan_token,
        courses (
          code,
          name
        )
      `)
      .gt("expires_at", now)           // Only active sessions
      .order("expires_at", { ascending: true })
      .limit(6);

    if (error) {
      console.error("Failed to fetch live sessions:", error);
      return { liveSessions: [] };
    }

    return { liveSessions: liveSessions || [] };
  },
  component: Index,
});

type LiveSession = {
  id: string;
  topic: string;
  expires_at: string;
  scan_token: string;
  courses: {
    code: string;
    name: string;
  } | null;
};

function Index() {
  const { liveSessions } = Route.useLoaderData();

  const features = [
    { icon: Zap, title: "Instant Check-in", text: "Students scan once and attendance is recorded instantly." },
    { icon: ShieldCheck, title: "Anti-Proxy Protection", text: "Time-limited QR codes prevent fake attendance." },
    { icon: Users, title: "Role-Based Access", text: "Separate secure interfaces for lecturers and students." },
    { icon: QrCode, title: "No Extra Hardware", text: "Works with any smartphone camera." },
    { icon: BarChart3, title: "Real-time Analytics", text: "Track attendance and generate reports easily." },
    { icon: Clock, title: "Time-Limited Sessions", text: "Lecturers control session duration." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(at_50%_30%,rgba(59,130,246,0.08),transparent)]" />
        
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card mb-8">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">
              Built for African Universities
            </span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tighter mb-6">
            Smart Attendance.<br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              One Scan Away.
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Replace paper registers with secure, time-limited QR codes. 
            Lecturers generate • Students scan • Attendance recorded instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg hover:scale-[1.02] transition-all"
            >
              <ScanLine className="w-6 h-6" />
              Get Started Free
            </Link>

            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl border border-border font-semibold text-lg hover:bg-muted transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Demo Card */}
        <div className="mt-20 max-w-4xl mx-auto px-6">
          <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="uppercase tracking-widest text-xs text-emerald-600 font-medium mb-2">
                    LIVE EXAMPLE
                  </div>
                  <h3 className="text-3xl font-bold mb-3">CSC 401 — Distributed Systems</h3>
                  <p className="text-muted-foreground mb-6">Topic: Consensus Algorithms & Raft Protocol</p>
                  <div className="flex items-center gap-4">
                    <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded-full text-sm font-medium">
                      ● Active Now
                    </span>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-2xl">
                    <QrCode className="w-52 h-52 text-white" strokeWidth={1.2} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Sessions Section */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-border">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="font-display text-4xl font-bold">Live Sessions Now</h2>
            <p className="text-muted-foreground mt-2">Currently active classes you can join</p>
          </div>
          <Link to="/student" className="text-primary hover:underline font-medium">
            View all sessions →
          </Link>
        </div>

        {liveSessions.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveSessions.map((session: LiveSession) => {
              const timeLeft = new Date(session.expires_at).getTime() - Date.now();
              const minutesLeft = Math.max(0, Math.floor(timeLeft / 60000));

              return (
                <div
                  key={session.id}
                  className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-mono text-sm text-emerald-600 font-medium">
                        {session.courses?.code || "UNKNOWN"}
                      </p>
                      <h3 className="font-semibold text-lg mt-1 line-clamp-2">
                        {session.topic}
                      </h3>
                    </div>
                    <div className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs px-3 py-1 rounded-full font-medium">
                      LIVE
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-sm">
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Expires in {minutesLeft} min
                    </div>
                    <Link
                      to="/student/scan"
                      search={{ token: session.scan_token }}
                      className="text-primary font-medium hover:underline flex items-center gap-1 group-hover:gap-2 transition-all"
                    >
                      Scan to Join <ScanLine className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed">
            <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">No live sessions at the moment.</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later or ask your lecturer to start a session.</p>
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-border">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Why Universities Love ScanMark
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-2xl p-8 hover:shadow-xl transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{title}</h3>
              <p className="text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-muted/30 py-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 ScanMark • Smart Attendance for Universities
        </div>
      </footer>
    </div>
  );
}