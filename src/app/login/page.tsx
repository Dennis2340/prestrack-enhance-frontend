"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { ArrowRight } from "lucide-react";
import { BUSINESS_CONFIG } from "../../../config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Login failed");
        return;
      }
      toast.success("Logged in");
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50">
      <Navbar />
      <MaxWidthWrapper className="mb-12 mt-24 flex flex-col items-center">
        <div className="text-center">
          <span className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-full text-pink-800 mb-6 inline-block">
            AI & WhatsApp Healthcare
          </span>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Welcome to {BUSINESS_CONFIG.name}
          </h1>
          <p className="mt-4 text-gray-600">
            Sign in to your dashboard to manage patients, visitors, conversations, meds and escalations
          </p>
        </div>

        <div className="mt-10 w-full max-w-md">
          <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white">
                {loading ? "Signing in…" : "Sign In"}
              </Button>
              <div className="text-center text-sm text-gray-600">
                <Link className="underline" href="/">Back to home</Link>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            New provider? Contact an admin to create your account
            <ArrowRight className="inline ml-2 h-4 w-4 text-gray-500" />
          </div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
}
