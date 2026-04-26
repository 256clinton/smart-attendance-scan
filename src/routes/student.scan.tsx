import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, ScanLine, CheckCircle2, XCircle, Loader2, Camera } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/student/scan")({
  validateSearch: searchSchema,
  component: ScanPage,
});

type Status = "idle" | "scanning" | "checking" | "success" | "error";

function ScanPage() {
  const { token: initialToken } = Route.useSearch();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [manualToken, setManualToken] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    if (role && role !== "student") { navigate({ to: "/lecturer" }); return; }
    if (initialToken) {
      void checkIn(initialToken);
    }
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, role]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        /* noop */
      }
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setStatus("scanning");
    setMessage("");
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decoded) => {
          await stopScanner();
          let token = decoded;
          try {
            const url = new URL(decoded);
            token = url.searchParams.get("token") ?? decoded;
          } catch { /* not a URL, treat as token */ }
          await checkIn(token);
        },
        () => { /* ignore per-frame errors */ }
      );
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message || "Could not access camera. Try entering the token manually.");
    }
  };

  const checkIn = async (token: string) => {
    if (!user) return;
    setStatus("checking");
    setMessage("");

    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, course_id, topic, expires_at, courses(code, name)")
      .eq("scan_token", token.trim())
      .maybeSingle();

    if (sErr || !session) {
      setStatus("error");
      setMessage("Invalid QR code or you're not enrolled in this course.");
      return;
    }
    if (new Date(session.expires_at) <= new Date()) {
      setStatus("error");
      setMessage("This session has expired.");
      return;
    }

    const { error: insErr } = await supabase.from("attendance").insert({
      session_id: session.id,
      student_id: user.id,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        setStatus("success");
        setMessage(`Already checked in to ${session.courses?.code} — ${session.topic}`);
        toast.info("Already checked in");
      } else {
        setStatus("error");
        setMessage(insErr.message);
      }
      return;
    }

    setStatus("success");
    setMessage(`Checked in to ${session.courses?.code} — ${session.topic}`);
    toast.success("Attendance recorded");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/student" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
        </Link>

        <h1 className="font-display text-3xl font-bold mb-2">Scan attendance QR</h1>
        <p className="text-muted-foreground mb-8">Point your camera at the QR code shown by your lecturer.</p>

        <div className="bg-gradient-card rounded-3xl border border-border shadow-card p-6">
          <div
            id="qr-reader"
            className="aspect-square w-full bg-foreground/95 rounded-2xl overflow-hidden flex items-center justify-center text-background relative"
          >
            {status === "idle" && (
              <div className="text-center">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-70" />
                <p className="text-sm opacity-80">Camera off</p>
              </div>
            )}
            {status === "checking" && (
              <div className="absolute inset-0 bg-foreground/95 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin mb-2" />
                <p>Recording attendance...</p>
              </div>
            )}
            {status === "success" && (
              <div className="absolute inset-0 bg-success flex flex-col items-center justify-center text-success-foreground p-6 text-center">
                <CheckCircle2 className="w-16 h-16 mb-3" />
                <p className="font-display text-xl font-semibold">{message}</p>
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 bg-destructive flex flex-col items-center justify-center text-destructive-foreground p-6 text-center">
                <XCircle className="w-16 h-16 mb-3" />
                <p className="font-display text-lg font-semibold">{message}</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            {status !== "scanning" ? (
              <Button onClick={startScanner} className="flex-1" size="lg">
                <ScanLine className="w-5 h-5 mr-2" />
                {status === "success" || status === "error" ? "Scan again" : "Start scanning"}
              </Button>
            ) : (
              <Button onClick={() => { void stopScanner(); setStatus("idle"); }} variant="outline" className="flex-1" size="lg">
                Stop
              </Button>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm font-medium mb-2">Or enter token manually</p>
            <form
              onSubmit={(e) => { e.preventDefault(); if (manualToken.trim()) void checkIn(manualToken.trim()); }}
              className="flex gap-2"
            >
              <Input
                placeholder="Paste session token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
              />
              <Button type="submit" variant="secondary">Check in</Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
