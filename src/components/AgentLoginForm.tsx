// eslint-disable-next-line @typescript-eslint/no-unused-vars
"use client";
import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { BUSINESS_CONFIG } from "../../config";
import { LogIn, CheckCircle2, Shield, ArrowRight } from "lucide-react";

interface Props {
  businessId: string;
}

const AgentLoginForm: React.FC<Props> = ({ businessId }) => {
  const [email, setEmail] = useState("");
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/agent/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          agentId: agentId.trim(),
          businessId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentData = {
          agentId: data.agent.agentId,
          name: data.agent.name,
          email: data.agent.email,
        };
        localStorage.setItem("currentAgent", JSON.stringify(agentData));
        toast.success("Login successful!");
        router.push("/agent");
      } else {
        const errorData = await res.json();
        toast.error(
          errorData.error || "Invalid credentials. Please try again."
        );
      }
    } catch (error) {
      console.error("Error during login:", error);
      toast.error("An error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="flex flex-col lg:flex-row justify-between items-center py-16 md:py-24 px-5">
        {/* Left Side: Information Panel */}
        <div className="w-full lg:w-1/2 mb-12 lg:mb-0 pr-0 lg:pr-12">
          <div className="max-w-md mx-auto lg:mx-0">
            <div className="flex items-center space-x-2 mb-4">
              <LogIn className="w-6 h-6 text-teal-600" />
              <span className="text-sm font-medium bg-teal-100 text-teal-800 px-3 py-1 rounded-full">
                Agent Portal
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Welcome to the{" "}
              <span className="bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                {BUSINESS_CONFIG.name} portal
              </span>
            </h1>

            <p className="text-gray-600 mb-8 text-lg">
              Sign in to access your agent dashboard, manage customer
              conversations, and provide exceptional support through our live
              chat platform.
            </p>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="ml-3">
                  <p className="text-gray-800 font-medium">
                    Centralized Dashboard
                  </p>
                  <p className="text-gray-600 text-sm">
                    Manage all your customer conversations in one place
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="ml-3">
                  <p className="text-gray-800 font-medium">
                    Real-time Notifications
                  </p>
                  <p className="text-gray-600 text-sm">
                    Never miss an important customer message
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div className="ml-3">
                  <p className="text-gray-800 font-medium">Secure Access</p>
                  <p className="text-gray-600 text-sm">
                    Your agent portal is protected with advanced security
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full lg:w-1/2">
          <div className="relative">
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-green-100 rounded-full blur-2xl opacity-70 -z-10"></div>
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-teal-100 rounded-full blur-2xl opacity-70 -z-10"></div>

            <Card className="border-0 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Agent Login
                </CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email Address
                    </label>
                    <Input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="agentId"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Agent ID
                    </label>
                    <Input
                      type="text"
                      id="agentId"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      required
                      className="h-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter your agent ID"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your unique identifier provided by your administrator
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 mt-4 bg-gradient-to-r from-teal-600 to-green-600 text-white hover:from-teal-700 hover:to-green-700 rounded-lg font-medium"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Logging in...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        Sign In
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </Button>

                  <div className="text-center text-sm text-gray-500">
                    Need help?{" "}
                    <a href="#" className="text-teal-600 hover:underline">
                      Contact your administrator
                    </a>{" "}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentLoginForm;
