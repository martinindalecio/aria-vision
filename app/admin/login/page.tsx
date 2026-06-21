"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Authentication failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-black font-mono">
      <div className="w-full max-w-sm border border-hud-dark p-8">
        <div className="mb-6">
          <div className="mb-1 text-xs tracking-widest opacity-50">ARIA VISION</div>
          <div className="glow text-sm tracking-widest">ADMIN ACCESS</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs tracking-widest opacity-50">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-hud-dark bg-black px-3 py-2 text-sm text-hud outline-none focus:border-hud"
              style={{ caretColor: "var(--green)" }}
            />
          </div>

          {error && (
            <div className="text-xs tracking-widest" style={{ color: "#ff3b30" }}>
              [{error.toUpperCase()}]
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full border border-hud py-2 text-xs tracking-widest text-hud transition-opacity hover:opacity-70 disabled:opacity-30"
          >
            {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
          </button>
        </form>
      </div>
    </main>
  );
}
