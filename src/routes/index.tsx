import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanLine, QrCode, Users, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border shadow-soft mb-8">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">Built for modern universities</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
            Lecture attendance
            <br />
            <span className="text-gradient">in a single scan.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            ScanMark replaces paper registers with secure, time-limited QR codes.
            Lecturers generate, students scan, records appear instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.02] transition-smooth"
            >
              <ScanLine className="w-5 h-5" /> Start Free
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-card border border-border font-semibold hover:bg-muted transition-smooth shadow-soft"
            >
              I already have an account
            </Link>
          </div>

          {/* Mock card */}
          <div className="mt-20 max-w-3xl mx-auto">
            <div className="bg-gradient-card rounded-3xl border border-border shadow-card p-8 md:p-10 text-left">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Live session</div>
                  <h3 className="font-display text-2xl font-bold mb-1">CSC 401 — Distributed Systems</h3>
                  <p className="text-muted-foreground mb-4">Topic: Consensus Algorithms</p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="px-3 py-1 rounded-full bg-success/10 text-success font-medium">● Active</span>
                    <span className="text-muted-foreground">Expires in 09:42</span>
                  </div>
                </div>
                <div className="aspect-square max-w-[220px] mx-auto bg-foreground rounded-2xl p-4 flex items-center justify-center">
                  <QrCode className="w-full h-full text-background" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="font-display text-4xl md:text-5xl font-bold text-center mb-4">Why ScanMark?</h2>
        <p className="text-muted-foreground text-center max-w-xl mx-auto mb-16">
          Designed with lecturers, students, and academic administrators in mind.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Instant check-in", text: "Students scan, attendance is recorded in under a second." },
            { icon: ShieldCheck, title: "Anti-proxy", text: "Time-limited tokens prevent screenshot sharing or fake attendance." },
            { icon: Users, title: "Role-based", text: "Separate flows for lecturers and students with secure permissions." },
            { icon: QrCode, title: "No hardware", text: "Works with any smartphone — no biometric scanners needed." },
            { icon: BarChart3, title: "Real-time records", text: "See exactly who attended, when, from any device." },
            { icon: ScanLine, title: "Built for scale", text: "From a single class to an entire university campus." },
          ].map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="bg-gradient-card rounded-2xl border border-border p-6 shadow-soft hover:shadow-card transition-smooth"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 ScanMark</span>
          <span>Smart attendance for universities</span>
        </div>
      </footer>
    </div>
  );
}
