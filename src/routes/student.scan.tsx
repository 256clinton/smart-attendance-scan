import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ScanLine,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  RefreshCw,
} from "lucide-react";
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

  // Cleanup scanner
  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  // Auth + initial token
  useEffect(() => {
    if (authLoading || !user) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (role && role !== "student") {
      navigate({ to: "/lecturer", replace: true });
      return;
    }

    if (initialToken) {
      void checkIn(initialToken);
    }
  }, [authLoading, user, role, initialToken, navigate]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
  }, []);

  const startScanner = async () => {
    setStatus("scanning");
    setMessage("");

    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 280, height: 280 } },
        async (decodedText) => {
          // Immediately stop scanner on successful detection
          await stopScanner();

          let token = decodedText.trim();
          try {
            const url = new URL(decodedText);
            token = url.searchParams.get("token") ?? token;
          } catch {}

          // Directly check in without showing "checking" state for faster UX
          await handleCheckIn(token);
        },
        () => {} // Ignore per-frame errors
      );
    } catch (err: any) {
      setStatus("error");
      setMessage(
        err.message?.includes("Permission")
          ? "Camera permission denied."
          : "Failed to start camera. Try manual entry."
      );
    }
  };

  // New function: Directly show success after scan
  const handleCheckIn = async (token: string) => {
    if (!user || !token) return;

    // Show checking briefly (very short) then proceed
    setStatus("checking");
    setMessage("Recording attendance...");

    try {
      const { data: session, error: fetchError } = await supabase
        .from("sessions")
        .select(`
          id, 
          topic, 
          expires_at,
          courses(code, name)
        `)
        .eq("scan_token", token.trim())
        .maybeSingle();

      if (fetchError || !session) {
        setStatus("error");
        setMessage("Invalid QR code or you're not enrolled in this course.");
        toast.error("Invalid session");
        return;
      }

      if (new Date(session.expires_at) <= new Date()) {
        setStatus("error");
        setMessage("This session has expired.");
        toast.error("Session expired");
        return;
      }

      const { error: insertError } = await supabase.from("attendance").insert({
        session_id: session.id,
        student_id: user.id,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          setStatus("success");
          setMessage(`Already checked in to ${session.courses?.code} — ${session.topic}`);
          toast.info("Already checked in");
        } else {
          throw insertError;
        }
        return;
      }

      // SUCCESS - Show immediately
      setStatus("success");
      setMessage(`Successfully checked in to ${session.courses?.code} — ${session.topic}`);
      toast.success("Attendance recorded!");

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage("Failed to record attendance. Please try again.");
      toast.error("Check-in failed");
    }
  };

  const resetScanner = () => {
    setStatus("idle");
    setMessage("");
    setManualToken("");
    void stopScanner();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <Link
          to="/student"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
        </Link>

        <h1 className="font-display text-4xl font-bold tracking-tight mb-2">
          Mark Attendance
        </h1>
        <p className="text-muted-foreground mb-8">
          Scan the QR code shown by your lecturer
        </p>

        <div className="bg-card border border-border rounded-3xl shadow-xl overflow-hidden">
          <div className="relative aspect-square bg-zinc-950" id="qr-reader-container">
            <div id="qr-reader" className="w-full h-full" />

            {/* Status Overlays */}
            {status === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
                <Camera className="w-16 h-16 mb-4 opacity-60" />
                <p className="text-lg">Ready to scan</p>
              </div>
            )}

            {status === "checking" && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p>Recording attendance...</p>
              </div>
            )}

            {status === "success" && (
              <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-white p-8 text-center">
                <CheckCircle2 className="w-20 h-20 mb-6" />
                <p className="text-2xl font-semibold mb-2">Checked In Successfully!</p>
                <p className="text-lg opacity-90">{message}</p>
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center text-white p-8 text-center">
                <XCircle className="w-20 h-20 mb-6" />
                <p className="text-xl font-semibold mb-2">Check-in Failed</p>
                <p className="text-base opacity-90">{message}</p>
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            <div className="flex gap-3">
              {status !== "scanning" ? (
                <Button onClick={startScanner} size="lg" className="flex-1">
                  <ScanLine className="w-5 h-5 mr-2" />
                  {status === "success" || status === "error" ? "Scan Again" : "Start Scanning"}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    void stopScanner();
                    setStatus("idle");
                  }}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  Stop Scanning
                </Button>
              )}

              {(status === "success" || status === "error") && (
                <Button onClick={resetScanner} variant="ghost" size="lg">
                  <RefreshCw className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Manual Token Entry */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-3 text-muted-foreground">
                Or enter token manually
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualToken.trim()) void handleCheckIn(manualToken.trim());
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Paste session token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="font-mono"
                />
                <Button type="submit" variant="secondary">
                  Check In
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}