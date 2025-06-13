/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import AgentNavbar from "@/components/AgentNavbar";
import { BUSINESS_CONFIG, config } from "../../../config";
import {
  MessageCircle,
  Users,
  User,
  Clock,
  Activity,
  AlertCircle,
  FileText,
  Calendar,
  Bell,
  Edit2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import MedicalForm from "@/components/MedicalForm";

interface User {
  id: string;
  name: string | null;
  email: string | null;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  sender: User | null;
  senderType: string;
  taggedAgents: User[];
}

interface Room {
  id: string;
  name?: string;
  status: "active" | "closed";
  messages: Message[];
  guest: User | null;
  activeAgents: User[];
  medicalData?: {
    pregnancyStatus?: string;
    conditions?: Record<string, string>;
    medications?: Record<string, string>;
    allergies?: Record<string, string>;
    bloodType?: string;
    lastVisitDate?: string;
  };
  visits?: {
    id: string;
    scheduledTime: string;
    status: "scheduled" | "completed" | "cancelled";
    notes?: string;
    createdAt: string;
  }[];
  reminders?: {
    id: string;
    message: string;
    scheduledTime: string;
    createdAt: string;
  }[];
}

interface Agent {
  agentId: string;
  name: string;
}

const SkeletonCard: React.FC = () => (
  <Card className="shadow-sm border border-slate-200 bg-white/50 backdrop-blur-sm overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-teal-50/50 opacity-50"></div>
    <CardHeader className="relative">
      <div className="h-6 w-3/4 bg-slate-200 animate-pulse rounded-md"></div>
    </CardHeader>
    <CardContent className="relative">
      <div className="h-4 w-full bg-slate-200 animate-pulse rounded-md mb-2"></div>
      <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded-md mb-4"></div>
    </CardContent>
  </Card>
);



const AgentDashboard = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [agentStatus, setAgentStatus] = useState({
    isOnline: false,
    lastActive: new Date().toISOString(),
  });
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isMedicalFormOpen, setIsMedicalFormOpen] = useState(false);

  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const res = await fetch(
        `/api/rooms/?businessId=${BUSINESS_CONFIG.businessId}&includeMedical=true&includeVisits=true&includeReminders=true`
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch rooms: ${res.status}`);
      }
      const data = await res.json();
      setRooms(data.rooms);
      updateActiveAgents(data.rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const updateActiveAgents = (roomsData: Room[]) => {
    setIsLoadingAgents(true);
    const allAgents = roomsData?.flatMap((room) => room.activeAgents);
    const uniqueAgents = Array.from(
      new Map(
        allAgents?.map((agent) => [
          agent.id,
          { agentId: agent.id, name: agent.name || "Unknown" },
        ])
      ).values()
    );
    setAgents(uniqueAgents);
    setIsLoadingAgents(false);
  };

  useEffect(() => {
    const storedAgent = localStorage.getItem("currentAgent");
    if (storedAgent) {
      try {
        setCurrentAgent(JSON.parse(storedAgent));
      } catch (error) {
        console.error("Error parsing currentAgent:", error);
        router.push("/agent/login");
      }
    } else {
       router.push("/agent/login");
    }
  }, [router]);

  useEffect(() => {
    if (!currentAgent) return;

    socketRef.current = io(config.public.socketUrl || "http://localhost:5000", {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    fetchRooms();

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit(
        "agentLogin",
        {
          name: currentAgent.name,
          agentId: currentAgent.agentId,
          businessId: BUSINESS_CONFIG.businessId,
        },
        (error: any, response: any) => {
          if (error) {
            console.error("Agent login failed:", error);
          } else {
            console.log("Agent login successful:", {
              agentId: response.agentId,
              name: response.name,
              globalRoomId: response.globalRoomId,
            });
          }
        }
      );
      socket.emit("authMessage", {
        type: "auth",
        agentId: currentAgent.agentId,
      });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("roomCreated", (room: Room & { businessId: string }) => {
      if (room.businessId === BUSINESS_CONFIG.businessId) {
        setRooms((prevRooms) => {
          if (!prevRooms.find((r) => r.id === room.id)) {
            const newRooms = [...prevRooms, room];
            updateActiveAgents(newRooms);
            return newRooms;
          }
          return prevRooms;
        });
      }
    });

    socket.on("agentStatus", ({ isOnline }) => {
      setAgentStatus({
        isOnline,
        lastActive: new Date().toISOString(),
      });
    });

    socket.on("agentJoined", (agent: Agent) => {
      setAgents((prevAgents) => {
        if (!prevAgents.find((a) => a.agentId === agent.agentId)) {
          return [...prevAgents, agent];
        }
        return prevAgents;
      });
    });

    socket.on(
      "newMessage",
      (message: Message & { roomId: string; businessId: string }) => {
        if (message.businessId === BUSINESS_CONFIG.businessId) {
          setRooms((prevRooms) => {
            const updatedRooms = prevRooms.map((room) =>
              room.id === message.roomId
                ? {
                    ...room,
                    messages: [message, ...room.messages].slice(0, 1),
                  }
                : room
            );
            updateActiveAgents(updatedRooms);
            return updatedRooms;
          });
        }
      }
    );

    const heartbeatInterval = setInterval(() => {
      socket.emit("heartbeat");
    }, 1000);

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("roomCreated");
      socket.off("agentStatus");
      socket.off("agentJoined");
      socket.off("newMessage");
      clearInterval(heartbeatInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentAgent]);

  const handleJoinRoom = (roomId: string) => {
    if (!currentAgent || !socketRef.current) return;

    socketRef.current.emit(
      "joinRoom",
      {
        roomId,
        agentId: currentAgent.agentId,
        businessId: BUSINESS_CONFIG.businessId,
      },
      (err: any) => {
        if (err) {
          console.error("Error joining room:", err);
        } else {
          router.push(`/agent/room/${roomId}`);
        }
      }
    );
  };

  const trimMessage = (content: string, maxLength: number = 50) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "…";
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    setIsMedicalFormOpen(true);
  };

  const primaryColor = BUSINESS_CONFIG.theme.primaryColor;
  const hoverColor = BUSINESS_CONFIG.theme.hoverColor;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <AgentNavbar />
      <MaxWidthWrapper className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8 py-8">
          {/* Header with glowing effect */}
          <div className="relative">
            <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute -top-20 -right-4 w-64 h-64 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -top-20 -left-4 w-64 h-64 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="relative text-center md:text-left">
              <h1
                className={`text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${primaryColor} to-blue-600`}
              >
                {BUSINESS_CONFIG.name} Agent Hub
              </h1>
              <p className="text-slate-600 mt-2">
                Interactive agent dashboard for real-time support
              </p>
            </div>
          </div>

          {/* Agent Status Card */}
          {currentAgent && (
            <Card
              className={`shadow-sm border border-${primaryColor}/20 bg-white/70 backdrop-blur-sm overflow-hidden`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r from-${primaryColor}/5 to-blue-50 opacity-50`}
              ></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-r from-${primaryColor} to-blue-500 flex items-center justify-center text-white`}
                  >
                    <User size={20} />
                  </div>
                  <div>
                    <h2 className="font-medium text-slate-800">
                      Agent Console
                    </h2>
                    <p className="text-slate-600">
                      Connected as{" "}
                      <span className={`font-semibold text-${primaryColor}`}>
                        {currentAgent.name}
                      </span>
                    </p>
                  </div>
                  <div className="ml-auto flex items-center">
                    <div className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></div>
                      {agentStatus.isOnline ? "Online" : "Offline"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card
              className={`shadow-sm border border-${primaryColor}/20 bg-white/70 backdrop-blur-sm overflow-hidden`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r from-${primaryColor}/5 to-blue-50 opacity-50`}
              ></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-center">
                  <div
                    className={`w-12 h-12 rounded-full bg-${primaryColor}/10 flex items-center justify-center text-${primaryColor}`}
                  >
                    <Users size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-500">
                      Active Agents
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800">
                      {isLoadingAgents ? "..." : agents.length}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`shadow-sm border border-${primaryColor}/20 bg-white/70 backdrop-blur-sm overflow-hidden`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r from-${primaryColor}/5 to-blue-50 opacity-50`}
              ></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-center">
                  <div
                    className={`w-12 h-12 rounded-full bg-${primaryColor}/10 flex items-center justify-center text-${primaryColor}`}
                  >
                    <MessageCircle size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-500">
                      Active Rooms
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800">
                      {isLoadingRooms ? "..." : rooms.length}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`shadow-sm border border-${primaryColor}/20 bg-white/70 backdrop-blur-sm overflow-hidden`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r from-${primaryColor}/5 to-blue-50 opacity-50`}
              ></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-center">
                  <div
                    className={`w-12 h-12 rounded-full bg-${primaryColor}/10 flex items-center justify-center text-${primaryColor}`}
                  >
                    <Activity size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-500">
                      System Status
                    </p>
                    <h3 className="text-xl font-bold text-slate-800">
                      <span className="text-green-600 flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                        Operational
                      </span>
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Guest Rooms Section */}
          <div className="mt-8">
            <div className="flex items-center mb-4">
              <MessageCircle className={`h-5 w-5 text-${primaryColor} mr-2`} />
              <h2 className="text-xl font-semibold text-slate-800">
                Active Guest Rooms
              </h2>
            </div>

            {isLoadingRooms ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
              </div>
            ) : rooms.length === 0 ? (
              <Card className="shadow-sm border border-slate-200 bg-white/70 backdrop-blur-sm p-6 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-slate-400 mr-2" />
                <p className="text-slate-500">
                  No active guest rooms at the moment.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.map((room) => (
                  <Card
                    key={room.id}
                    className={`shadow-sm border border-${primaryColor}/20 hover:shadow-md transition-all duration-200 bg-white/70 backdrop-blur-sm overflow-hidden group relative`}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br from-${primaryColor}/5 to-blue-50 opacity-0 group-hover:opacity-50 transition-opacity duration-200 pointer-events-none`}
                    ></div>

                    <CardHeader className="pb-2 relative border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-medium text-slate-800 flex items-center">
                          <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                          {room.name || "Guest Room"}
                        </CardTitle>
                        <div
                          className={`px-2 py-1 rounded-full bg-${primaryColor}/10 text-${primaryColor} text-xs font-medium`}
                        >
                          {room.status === "active" ? "Active" : "Closed"}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="relative pt-4">
                      <div className="space-y-4">
                        {/* Guest Information */}
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-1">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-r from-${primaryColor} to-blue-400 flex items-center justify-center text-white`}
                            >
                              <User size={16} />
                            </div>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-slate-700">
                              Guest
                            </h3>
                            {room.guest ? (
                              <div>
                                <p className="text-sm text-slate-800 font-medium">
                                  {room.guest.name || "Anonymous"}
                                </p>
                                {room.guest.email && (
                                  <p className="text-xs text-slate-500">
                                    {room.guest.email}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No guest assigned
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Active Agents */}
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-1">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-r from-${primaryColor} to-blue-400 flex items-center justify-center text-white`}
                            >
                              <Users size={16} />
                            </div>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-slate-700">
                              Active Agents ({room.activeAgents.length})
                            </h3>
                            {room.activeAgents.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No active agents
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {room.activeAgents.map((agent) => (
                                  <span
                                    key={agent.id}
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${primaryColor}/10 text-${primaryColor}`}
                                  >
                                    {agent.name || "Unknown"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Latest Message */}
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-1">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-r from-${primaryColor} to-blue-400 flex items-center justify-center text-white`}
                            >
                              <MessageCircle size={16} />
                            </div>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-slate-700">
                              Latest Message
                            </h3>
                            {room.messages.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No messages yet.
                              </p>
                            ) : (
                              <div
                                className={`mt-1 p-3 rounded-lg bg-white border border-${primaryColor}/20`}
                              >
                                {(() => {
                                  const latestMessage = room.messages[0];
                                  const senderType =
                                    latestMessage.senderType.toLowerCase();
                                  const senderColor =
                                    senderType === "guest"
                                      ? `text-${primaryColor}`
                                      : senderType === "agent"
                                      ? "text-blue-600"
                                      : `text-${primaryColor}`;

                                  return (
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span
                                          className={`text-xs font-medium ${senderColor}`}
                                        >
                                          {latestMessage.sender?.name ||
                                            "Unknown"}{" "}
                                          ({latestMessage.senderType})
                                        </span>
                                        <div className="flex items-center text-xs text-slate-400">
                                          <Clock size={12} className="mr-1" />
                                          {formatTimestamp(
                                            latestMessage.timestamp
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-sm text-slate-700">
                                        {trimMessage(latestMessage.content)}
                                      </p>
                                      {latestMessage.taggedAgents.length >
                                        0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {latestMessage.taggedAgents.map(
                                            (agent) => (
                                              <span
                                                key={agent.id}
                                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-${primaryColor}/10 text-${primaryColor}`}
                                              >
                                                @{agent.name || "Unknown"}
                                              </span>
                                            )
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Medical Information */}
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-1">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-r from-${primaryColor} to-blue-400 flex items-center justify-center text-white`}
                            >
                              <FileText size={16} />
                            </div>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-slate-700">
                              Medical Info
                            </h3>
                            {room.medicalData ? (
                              <div className="mt-1">
                                <p className="text-sm text-slate-500">
                                  {room.medicalData.conditions &&
                                    Object.keys(room.medicalData.conditions)
                                      .length > 0 && (
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-${primaryColor}/10 text-${primaryColor} mr-2`}
                                      >
                                        {
                                          Object.keys(
                                            room.medicalData.conditions
                                          ).length
                                        }{" "}
                                        Conditions
                                      </span>
                                    )}
                                  {room.medicalData.medications &&
                                    Object.keys(room.medicalData.medications)
                                      .length > 0 && (
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-${primaryColor}/10 text-${primaryColor} mr-2`}
                                      >
                                        {
                                          Object.keys(
                                            room.medicalData.medications
                                          ).length
                                        }{" "}
                                        Medications
                                      </span>
                                    )}
                                  {room.medicalData.allergies &&
                                    Object.keys(room.medicalData.allergies)
                                      .length > 0 && (
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-${primaryColor}/10 text-${primaryColor} mr-2`}
                                      >
                                        {
                                          Object.keys(
                                            room.medicalData.allergies
                                          ).length
                                        }{" "}
                                        Allergies
                                      </span>
                                    )}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No medical records
                              </p>
                            )}
                            <div className="flex space-x-2 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectRoom(room)}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                {room.medicalData ? "Edit" : "Add"} Medical Info
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Upcoming Visits */}
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-1">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-r from-${primaryColor} to-blue-400 flex items-center justify-center text-white`}
                            >
                              <Calendar size={16} />
                            </div>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-slate-700">
                              Upcoming Visits
                            </h3>
                            {room.visits?.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No upcoming visits
                              </p>
                            ) : (
                              <div className="mt-1">
                                {room.visits
                                  ?.filter(
                                    (visit) => visit.status === "scheduled"
                                  )
                                  .map((visit, index) => (
                                    <div
                                      key={visit.id}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-${primaryColor}/10 text-${primaryColor} ${
                                        index <
                                        (room.visits?.filter(
                                          (v) => v.status === "scheduled"
                                        ).length || 0) -
                                          1
                                          ? "mr-2"
                                          : ""
                                      }`}
                                    >
                                      {new Date(
                                        visit.scheduledTime
                                      ).toLocaleDateString()}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reminders */}
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-1">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-r from-${primaryColor} to-blue-400 flex items-center justify-center text-white`}
                            >
                              <Bell size={16} />
                            </div>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-slate-700">
                              Reminders
                            </h3>
                            {room.reminders?.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No reminders
                              </p>
                            ) : (
                              <div className="mt-1">
                                {room.reminders?.map((reminder, index) => (
                                  <div
                                    key={reminder.id}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-${primaryColor}/10 text-${primaryColor} ${
                                      index < (room.reminders?.length || 0) - 1
                                        ? "mr-2"
                                        : ""
                                    }`}
                                  >
                                    {new Date(
                                      reminder.scheduledTime
                                    ).toLocaleTimeString()}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 pb-4 relative z-10">
                      <Button
                        onClick={() => handleJoinRoom(room.id)}
                        className={`w-full bg-gradient-to-r from-${primaryColor} to-blue-600 hover:from-${hoverColor} hover:to-blue-700 text-white shadow-sm transition-all duration-200 group-hover:shadow-md`}
                        disabled={!currentAgent || !socketRef.current?.connected}
                      >
                        {!currentAgent || !socketRef.current?.connected ? (
                          <>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Not Connected
                          </>
                        ) : (
                          <>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Join Conversation
                            {room.messages.length > 0 && (
                              <span className="ml-1 text-xs text-slate-200">
                                ({room.messages.length} Messages)
                              </span>
                            )}
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </MaxWidthWrapper>

      {selectedRoom && isMedicalFormOpen && (
        <MedicalForm
          room={selectedRoom}
          onClose={() => setIsMedicalFormOpen(false)}
          onSave={fetchRooms}
        />
      )}
    </div>
  );
};

export default AgentDashboard;