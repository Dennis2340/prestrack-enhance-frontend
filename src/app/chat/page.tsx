/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
import React, { useState, FormEvent, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import GuestNavbar from "@/components/GuestNavbar";
import { toast } from "sonner";
import { config, BUSINESS_CONFIG } from "../../../config";
import {
  ArrowRight,
  Wifi,
  WifiOff,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
} from "lucide-react";

let socket: Socket | undefined;

const JoinChat: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("disconnected");
  const [previousChats, setPreviousChats] = useState<any>([]); // TODO: type any for now
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [guestSession, setGuestSession] = useState<any>(null);
  const router = useRouter();

  // Load existing session
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem("guestSession");
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        setGuestSession(parsedSession);
        setName(parsedSession.name || "");
        setEmail(parsedSession.email || "");

        // Fetch previous chats for this guest
        fetchPreviousChats(parsedSession.guestId);
      }
    } catch (error) {
      console.error("Error loading session:", error);
    }
  }, []);

  useEffect(() => {
    if (!socket) {
      socket = io(config.public.socketUrl || "http://localhost:5000", {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      console.log("Socket initialized:", socket?.id);

      socket.on("connect", () => {
        console.log("Socket connected:", socket?.id);
        setConnectionStatus("connected");
        toast.success("Connected to the server!");
      });

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setConnectionStatus("disconnected");
        toast.error("Disconnected from the server.");
      });

      socket.on("reconnect", (attempt) => {
        console.log("Socket reconnected after attempt:", attempt);
        setConnectionStatus("connected");
        toast.success("Reconnected to the server!");
      });

      socket.on("reconnect_attempt", () => {
        console.log("Socket reconnecting...");
        setConnectionStatus("reconnecting");
      });

      socket.on("reconnect_error", (error) => {
        console.error("Reconnect error:", error);
        toast.error("Failed to reconnect. Please refresh the page.");
      });
    }

    return () => {
      // Optional cleanup if needed
    };
  }, []);

  const fetchPreviousChats = async (guestId: string) => {
    if (!guestId) return;

    setIsLoadingChats(true);
    try {
      const response = await fetch(`/api/guest-room/${guestId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Previous chats fetched:", data.guestChats);
        setPreviousChats(data.guestChats || []);
      } else {
        console.error("Failed to fetch previous chats");
      }
    } catch (error) {
      console.error("Error fetching previous chats:", error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter both name and email.");
      return;
    }
    if (!socket || !socket.connected) {
      toast.error(
        "Not connected to the server. Please wait or refresh the page."
      );
      return;
    }

    setIsSubmitting(true);

    socket.emit(
      "guestJoin",
      { name, email, businessId: BUSINESS_CONFIG.businessId },
      (err: any, data: any) => {
        setIsSubmitting(false);

        if (err) {
          console.error("Error joining as guest:", err);
          toast.error(`Failed to join chat: ${err}`);
        } else {
          console.log("Guest join response:", data);
          if (!data?.roomId || !data?.guestId) {
            console.error("Invalid response from server:", data);
            toast.error("Invalid server response. Please try again.");
            return;
          }

          const guestSession = {
            name,
            email,
            roomId: data.roomId,
            guestId: data.guestId,
            businessId: BUSINESS_CONFIG.businessId,
          };

          try {
            localStorage.setItem("guestSession", JSON.stringify(guestSession));
            console.log("guestSession stored in localStorage:", guestSession);
            toast.success("Successfully joined the chat!");
            router.push(`/chat/${data.roomId}`);
          } catch (storageError) {
            console.error(
              "Error storing guestSession in localStorage:",
              storageError
            );
            toast.error("Failed to save session. Please try again.");
          }
        }
      }
    );
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="h-5 w-5 text-green-500" />;
      case "disconnected":
        return <WifiOff className="h-5 w-5 text-red-500" />;
      case "reconnecting":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resumeChat = (roomId: string) => {
    if (guestSession) {
      const updatedSession = {
        ...guestSession,
        roomId,
      };
      localStorage.setItem("guestSession", JSON.stringify(updatedSession));
      router.push(`/chat/${roomId}`);
    } else {
      toast.error("Session information missing. Please start a new chat.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <GuestNavbar />

      <MaxWidthWrapper>
        <div className="flex flex-col lg:flex-row justify-between items-center py-16 md:py-24">
          {/* Left Side: Information Panel */}
          <div className="w-full lg:w-1/2 mb-12 lg:mb-0 pr-0 lg:pr-12">
            <div className="max-w-md mx-auto lg:mx-0">
              <div className="flex items-center space-x-2 mb-4">
                <MessageCircle className="w-6 h-6 text-teal-600" />
                <span className="text-sm font-medium bg-teal-100 text-teal-800 px-3 py-1 rounded-full">
                  Live Support
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Get assistance from our{" "}
                <span className="bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                  expert team
                </span>
              </h1>

              <p className="text-gray-600 mb-8 text-lg">
                Connect with our support agents or AI assistant to get immediate
                help with your inquiries, account issues, or financial
                questions.
              </p>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-800 font-medium">Real-time Chat</p>
                    <p className="text-gray-600 text-sm">
                      Instant responses from our support team
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-800 font-medium">
                      Secure Connection
                    </p>
                    <p className="text-gray-600 text-sm">
                      Your conversation is encrypted and private
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-800 font-medium">24/7 Assistance</p>
                    <p className="text-gray-600 text-sm">
                      Our AI is available even when human agents are offline
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form & Previous Chats */}
          <div className="w-full lg:w-1/2">
            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-green-100 rounded-full blur-2xl opacity-70 -z-10"></div>
              <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-teal-100 rounded-full blur-2xl opacity-70 -z-10"></div>

              <Card className="border-0 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      Join {BUSINESS_CONFIG.name} Chat
                    </CardTitle>
                    <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-full">
                      {getConnectionIcon()}
                      <span
                        className={`text-sm font-medium ${
                          connectionStatus === "connected"
                            ? "text-green-700"
                            : connectionStatus === "reconnecting"
                            ? "text-amber-700"
                            : "text-red-700"
                        }`}
                      >
                        {connectionStatus === "connected"
                          ? "Connected"
                          : connectionStatus === "reconnecting"
                          ? "Reconnecting..."
                          : "Disconnected"}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleJoin} className="space-y-6">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Your Name
                      </label>
                      <Input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="h-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="Enter your full name"
                        disabled={connectionStatus !== "connected"}
                      />
                    </div>

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
                        disabled={connectionStatus !== "connected"}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        We&apos;ll use this to send chat transcripts if requested
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className={`w-full h-12 mt-4 bg-gradient-to-r from-teal-600 to-green-600 text-white hover:from-teal-700 hover:to-green-700 rounded-lg font-medium ${
                        connectionStatus !== "connected"
                          ? "opacity-70 cursor-not-allowed"
                          : ""
                      }`}
                      disabled={
                        connectionStatus !== "connected" || isSubmitting
                      }
                    >
                      {isSubmitting ? (
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
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          {connectionStatus === "connected"
                            ? "Start New Chat"
                            : connectionStatus === "reconnecting"
                            ? "Reconnecting..."
                            : "Waiting for Connection"}
                          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </span>
                      )}
                    </Button>

                    <div className="text-center text-sm text-gray-500">
                      By joining, you agree to our{" "}
                      <a href="#" className="text-teal-600 hover:underline">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="#" className="text-teal-600 hover:underline">
                        Privacy Policy
                      </a>
                    </div>
                  </form>

                  {/* Previous Chats Section */}
                  {previousChats.length > 0 && (
                    <div className="mt-10 pt-6 border-t border-gray-200">
                      <div className="flex items-center mb-4">
                        <History className="h-5 w-5 text-teal-600 mr-2" />
                        <h3 className="text-lg font-medium text-gray-900">
                          Your Previous Conversations
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {previousChats.map((chat: any) => (
                          <div
                            key={chat.id}
                            className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border border-gray-200"
                            onClick={() => resumeChat(chat.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center mb-1">
                                <span className="font-medium text-gray-900 truncate">
                                  Room #{chat.id}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate">
                                {chat.messages.length} Messages
                              </p>
                              <div className="flex items-center mt-1 text-xs text-gray-500">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDate(chat.updatedAt)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              className="ml-2 h-8 w-8 p-0 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                resumeChat(chat.roomId);
                              }}
                            >
                              <ArrowRight className="h-4 w-4 text-teal-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isLoadingChats && (
                    <div className="mt-8 text-center py-4">
                      <div className="inline-block animate-spin h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full mr-2"></div>
                      <span className="text-sm text-gray-600">
                        Loading your previous chats...
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
};

export default JoinChat;
