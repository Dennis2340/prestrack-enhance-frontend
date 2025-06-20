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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-2 sm:px-4 md:px-6">
      <div className="flex flex-col lg:flex-row justify-center items-center py-4 sm:py-6 lg:py-12 max-w-7xl mx-auto gap-4 lg:gap-12">
        {/* Left Side: Information Panel */}
        <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg lg:w-1/2 lg:pr-8">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start space-x-2 mb-2 sm:mb-3">
              <LogIn className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-teal-600" />
              <span className="text-[0.6rem] sm:text-xs md:text-sm font-medium bg-teal-100 text-teal-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                Doctor Portal
              </span>
            </div>

            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              Welcome to the{" "}
              <span className="bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                {BUSINESS_CONFIG.name} portal
              </span>
            </h1>

            <p className="text-gray-600 mb-3 sm:mb-4 text-[0.65rem] sm:text-xs md:text-sm lg:text-lg">
              Sign in to access your Doctor dashboard, manage Patient
              conversations, and provide exceptional support through our live
              chat platform, and also have insights about patients data and previous conversation.
            </p>

            <div className="space-y-1 sm:space-y-2 md:space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                  <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 text-green-500" />
                </div>
                <div className="ml-1 sm:ml-2 md:ml-3">
                  <p className="text-gray-800 font-medium text-[0.65rem] sm:text-xs md:text-sm lg:text-base">
                    Centralized Dashboard
                  </p>
                  <p className="text-gray-600 text-[0.6rem] sm:text-[0.65rem] md:text-xs lg:text-sm">
                    Manage all Patients conversations in one place
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                  <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 text-green-500" />
                </div>
                <div className="ml-1 sm:ml-2 md:ml-3">
                  <p className="text-gray-800 font-medium text-[0.65rem] sm:text-xs md:text-sm lg:text-base">
                    Real-time Notifications
                  </p>
                  <p className="text-gray-600 text-[0.6rem] sm:text-[0.65rem] md:text-xs lg:text-sm">
                    Stay updated with instant alerts
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                  <Shield className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 text-green-500" />
                </div>
                <div className="ml-1 sm:ml-2 md:ml-3">
                  <p className="text-gray-800 font-medium text-[0.65rem] sm:text-xs md:text-sm lg:text-base">
                    Secure Access
                  </p>
                  <p className="text-gray-600 text-[0.6rem] sm:text-[0.65rem] md:text-xs lg:text-sm">
                    Your Doctor portal is protected with advanced security
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:w-1/2">
          <div className="relative">
            {/* Decorative elements (hidden on very small screens) */}
            <div className="hidden md:block absolute -top-4 -right-4 w-20 h-20 sm:w-24 sm:h-24 bg-green-100 rounded-full blur-2xl opacity-70 -z-10"></div>
            <div className="hidden md:block absolute -bottom-6 -left-6 w-24 h-24 sm:w-28 sm:h-28 bg-teal-100 rounded-full blur-2xl opacity-70 -z-10"></div>

            <Card className="border-0 bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl">
              <CardHeader className="pb-2 sm:pb-3 md:pb-4">
                <CardTitle className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900">
                  Doctor Login
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-3 sm:space-y-4 md:space-y-5">
                  <div className="space-y-1">
                    <label
                      htmlFor="email"
                      className="block text-[0.65rem] sm:text-xs md:text-sm font-medium text-gray-700"
                    >
                      Email Address
                    </label>
                    <Input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-8 sm:h-9 md:h-10 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-[0.75rem] sm:text-sm"
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="agentId"
                      className="block text-[0.65rem] sm:text-xs md:text-sm font-medium text-gray-700"
                    >
                      Agent ID
                    </label>
                    <Input
                      type="text"
                      id="agentId"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      required
                      className="h-8 sm:h-9 md:h-10 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-[0.75rem] sm:text-sm"
                      placeholder="Enter your agent ID"
                      disabled={loading}
                    />
                    <p className="text-[0.6rem] sm:text-[0.65rem] md:text-xs text-gray-500 mt-0.5 sm:mt-1">
                      Your unique identifier provided by your administrator
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleLogin}
                    className="w-full h-8 sm:h-9 md:h-10 mt-1 sm:mt-2 md:mt-3 bg-gradient-to-r from-teal-600 to-green-600 text-white hover:from-teal-700 hover:to-green-700 rounded-lg font-medium text-[0.65rem] sm:text-xs md:text-sm"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 text-white"
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
                        <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </Button>

                  <div className="text-center text-[0.6rem] sm:text-[0.65rem] md:text-xs text-gray-500">
                    Need help?{" "}
                    <a href="#" className="text-teal-600 hover:underline">
                      Contact your administrator
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentLoginForm;