/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2,
  UserPlus,
  Eye,
  Shield,
  Users,
  MessageSquare,
  Search,
  Clock,
  Filter,
  ArrowUpDown,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import AddAgentForm from "./AddAgentForm";
import MaxWidthWrapper from "./MaxWidthWrapper";
import ReactMarkdown from "react-markdown";
import { BUSINESS_CONFIG, config } from "../../config";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AgentPresence {
  isOnline: boolean;
  lastSeen: string;
}
interface Agent {
  _id: string;
  name: string;
  email: string;
  agentId: string;
  businessId: string;
  AgentPresence: AgentPresence;
}

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
}

interface Room {
  id: string;
  name?: string;
  status: "active" | "closed";
  messages: Message[];
  guest: User | null;
  activeAgents: User[];
  businessId: string;
}

const SkeletonCard: React.FC = () => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
      <div className="h-6 w-16 bg-gray-200 rounded"></div>
    </div>
    <div className="mt-3">
      <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
      <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
    </div>
    <div className="mt-4 flex justify-end">
      <div className="h-9 w-20 bg-gray-200 rounded mr-2"></div>
      <div className="h-9 w-20 bg-gray-200 rounded"></div>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomMessages, setSelectedRoomMessages] = useState<Message[]>(
    []
  );
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [showDeleteAgentConfirm, setShowDeleteAgentConfirm] = useState<
    string | null
  >(null);
  const [showDeleteRoomConfirm, setShowDeleteRoomConfirm] = useState<
    string | null
  >(null);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [roomStatusFilter, setRoomStatusFilter] = useState<
    "all" | "active" | "closed"
  >("all");
  const [agentSort, setAgentSort] = useState<"name" | "email">("name");
  const [roomSort, setRoomSort] = useState<"newest" | "oldest" | "messages">(
    "newest"
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch all agents for the current business
  const fetchAgents = async () => {
    setIsLoadingAgents(true);
    try {
      const response = await fetch(
        `/api/agent/list?businessId=${BUSINESS_CONFIG.businessId}`
      );
      const data = await response.json();

      setAgents(data.agents);
    } catch (err) {
      toast("Error! Failed to load agents");
      console.error("Error fetching agents:", err);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  // Fetch all rooms for the current business
  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const response = await fetch(
        `/api/rooms?businessId=${BUSINESS_CONFIG.businessId}`
      );
      const data = await response.json();
      setRooms(data.rooms);
    } catch (err) {
      toast("Error! Failed to load rooms");
      console.error("Error fetching rooms:", err);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // Fetch messages for a specific room
  const fetchRoomMessages = async (roomId: string) => {
    try {
      setSelectedRoomId(roomId);
      const response = await fetch(
        `/api/rooms/${roomId}?businessId=${BUSINESS_CONFIG.businessId}`
      );
      const data = await response.json();
      setSelectedRoomMessages(data.messages);
      setShowRoomModal(true);
    } catch (err) {
      toast("Error! Failed to load room messages");
      console.error("Error fetching room messages:", err);
    }
  };

  // Socket setup and initial data fetch
  useEffect(() => {
    fetchAgents();
    fetchRooms();

    socketRef.current = io(config.public.socketUrl || "http://localhost:5000", {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;
    socket.on("connect", () => {
      console.log("Admin socket connected:", socket.id);
      socket.emit("joinBusiness", { businessId: BUSINESS_CONFIG.businessId });
    });

    socket.on("disconnect", (reason) => {
      console.log("Admin socket disconnected:", reason);
    });

    socket.on("roomCreated", (room: Room) => {
      if (room.businessId === BUSINESS_CONFIG.businessId) {
        setRooms((prev) => [...prev, room]);
      }
    });

    socket.on("newMessage", (message: Message & { roomId: string }) => {
      setRooms((prev) =>
        prev.map((room) =>
          room.id === message.roomId &&
          room.businessId === BUSINESS_CONFIG.businessId
            ? { ...room, messages: [message, ...room.messages].slice(0, 1) }
            : room
        )
      );

      // If this message belongs to the currently viewed room, update the messages
      if (selectedRoomId === message.roomId) {
        setSelectedRoomMessages((prev) => [message, ...prev]);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("roomCreated");
      socket.off("newMessage");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedRoomId]);

  // Handle agent addition
  const handleAgentAdded = () => {
    fetchAgents();
    setShowAddAgentModal(false);
    toast("Success! Agent added successfully");
  };

  // Handle agent deletion
  const handleDeleteAgent = (id: string) => {
    setShowDeleteAgentConfirm(id);
  };

  const confirmDeleteAgent = async () => {
    if (!showDeleteAgentConfirm) return;
    try {
      const response = await fetch(
        `/api/agent/delete/${showDeleteAgentConfirm}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        fetchAgents();
        toast("Agent deleted successfully");
      } else {
        toast("Failed to delete agent");
      }
    } catch (err) {
      console.error("Error deleting agent:", err);
      toast("An error occurred, please try again later");
    } finally {
      setShowDeleteAgentConfirm(null);
    }
  };

  // Handle room deletion
  const handleDeleteRoom = (roomId: string) => {
    setShowDeleteRoomConfirm(roomId);
  };

  const confirmDeleteRoom = async () => {
    if (!showDeleteRoomConfirm) return;
    try {
      const response = await fetch(`/api/rooms/${showDeleteRoomConfirm}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setRooms((prev) =>
          prev.filter((room) => room.id !== showDeleteRoomConfirm)
        );
        toast("Room deleted successfully");
      } else {
        toast("Failed to delete room");
      }
    } catch (err) {
      console.error("Error deleting room:", err);
      toast("Error deleting room");
    } finally {
      setShowDeleteRoomConfirm(null);
    }
  };

  // Trim message content for display
  const trimMessage = (content: string, maxLength: number = 50) => {
    return content.length <= maxLength
      ? content
      : content.slice(0, maxLength) + "…";
  };

  // Filter and sort agents
  const filteredAgents = agents
    .filter((agent) => {
      if (!agentSearchQuery) return true;
      return (
        agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
        agent.email.toLowerCase().includes(agentSearchQuery.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (agentSort === "name") return a.name.localeCompare(b.name);
      return a.email.localeCompare(b.email);
    });

  // Filter and sort rooms
  const filteredRooms = rooms
    .filter((room) => {
      let statusMatch = true;
      if (roomStatusFilter !== "all") {
        statusMatch = room.status === roomStatusFilter;
      }

      if (!roomSearchQuery) return statusMatch;

      const guestName = room.guest?.name?.toLowerCase() || "";
      const roomId = room.id.toLowerCase();
      const searchLower = roomSearchQuery.toLowerCase();

      return (
        statusMatch &&
        (guestName.includes(searchLower) || roomId.includes(searchLower))
      );
    })
    .sort((a, b) => {
      if (roomSort === "newest") {
        return (
          new Date(b.messages[0]?.timestamp || 0).getTime() -
          new Date(a.messages[0]?.timestamp || 0).getTime()
        );
      } else if (roomSort === "oldest") {
        return (
          new Date(a.messages[0]?.timestamp || 0).getTime() -
          new Date(b.messages[0]?.timestamp || 0).getTime()
        );
      } else {
        return b.messages.length - a.messages.length;
      }
    });

  return (
    <MaxWidthWrapper>
      <div className="space-y-6 mt-6 pb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-green-600" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-teal-400 text-transparent bg-clip-text">
            {BUSINESS_CONFIG.name} Admin Dashboard
          </h1>
        </div>

        <Tabs defaultValue="agents" className="mt-6">
          <TabsList className="mb-6 bg-gray-100">
            <TabsTrigger
              value="agents"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-500 data-[state=active]:text-white"
            >
              <Users className="h-4 w-4 mr-2" />
              Agents
            </TabsTrigger>
            <TabsTrigger
              value="rooms"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-500 data-[state=active]:text-white"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Support Rooms
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:w-1/2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search agents by name or email..."
                  value={agentSearchQuery}
                  onChange={(e) => setAgentSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <ArrowUpDown className="h-4 w-4" /> Sort by{" "}
                      {agentSort === "name" ? "Name" : "Email"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setAgentSort("name")}>
                      Sort by Name
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAgentSort("email")}>
                      Sort by Email
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Dialog
                  open={showAddAgentModal}
                  onOpenChange={setShowAddAgentModal}
                >
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-green-500 to-teal-500 text-white hover:from-green-600 hover:to-teal-600 transition-all duration-300 flex items-center gap-2">
                      <UserPlus size={16} /> Add Agent
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white rounded-lg shadow-md">
                    <DialogHeader>
                      <DialogTitle className="text-gray-800">
                        Add New Agent
                      </DialogTitle>
                    </DialogHeader>
                    <AddAgentForm
                      onAgentAdded={handleAgentAdded}
                      onClose={() => setShowAddAgentModal(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {isLoadingAgents ? (
              <div className="space-y-4">
                {Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
              </div>
            ) : filteredAgents.length === 0 ? (
              <Card className="bg-gray-50 p-6 text-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Users className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-lg font-medium">No agents found</p>
                  <p className="text-sm">
                    Try adjusting your search or add a new agent
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredAgents.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                      <div className="flex items-start md:items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center text-white font-medium">
                          {agent.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .substring(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-800">
                            {agent.name}
                          </h3>
                          <div className="flex flex-col mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-gray-700">
                                Online Status:
                              </h3>
                              <span
                                className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                                  agent?.AgentPresence?.isOnline
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {agent?.AgentPresence?.isOnline
                                  ? "Online ✅"
                                  : "Offline ❌"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-gray-700">
                                Last Seen:
                              </h3>
                              <span className="text-sm text-gray-600">
                                {agent?.AgentPresence?.lastSeen
                                  ? new Date(
                                      agent.AgentPresence.lastSeen
                                    ).toLocaleString()
                                  : "N/A"}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-gray-600">{agent.email}</p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            ID: {agent.agentId.substring(0, 8)}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center gap-2 ml-0 md:ml-auto"
                        onClick={() => handleDeleteAgent(agent.agentId)}
                      >
                        <Trash2 size={16} /> Remove Agent
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms" className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:w-1/2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search rooms by guest name or ID..."
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Filter className="h-4 w-4" />
                      {roomStatusFilter === "all"
                        ? "All Rooms"
                        : roomStatusFilter === "active"
                        ? "Active Rooms"
                        : "Closed Rooms"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => setRoomStatusFilter("all")}
                    >
                      All Rooms
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setRoomStatusFilter("active")}
                    >
                      Active Rooms
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setRoomStatusFilter("closed")}
                    >
                      Closed Rooms
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      {roomSort === "newest"
                        ? "Newest First"
                        : roomSort === "oldest"
                        ? "Oldest First"
                        : "Most Messages"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setRoomSort("newest")}>
                      Newest First
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRoomSort("oldest")}>
                      Oldest First
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRoomSort("messages")}>
                      Most Messages
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isLoadingRooms ? (
              <div className="space-y-4">
                {Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <Card className="bg-gray-50 p-6 text-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-lg font-medium">No rooms found</p>
                  <p className="text-sm">
                    Try adjusting your search or filter settings
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-800">
                            {room.name || `Room ${room.id.substring(0, 8)}`}
                          </h3>
                          <Badge
                            className={`${
                              room.status === "active"
                                ? "bg-gradient-to-r from-green-500 to-teal-500"
                                : "bg-gray-500"
                            } text-white border-0`}
                          >
                            {room.status === "active" ? (
                              <div className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                                Active
                              </div>
                            ) : (
                              "Closed"
                            )}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              Guest:
                            </p>
                            <p className="text-sm text-gray-600">
                              {room.guest?.name || "Unknown Guest"}
                              {room.guest?.email && (
                                <span className="text-xs text-gray-500 block">
                                  {room.guest.email}
                                </span>
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              Active Agents: {room.activeAgents.length}
                            </p>
                            {room.activeAgents.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {room.activeAgents.map((agent) => (
                                  <Badge
                                    key={agent.id}
                                    variant="outline"
                                    className="text-xs font-normal"
                                  >
                                    {agent.name || "Unknown"}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No agents</p>
                            )}
                          </div>
                        </div>

                        {room.messages.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded-md border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Latest message (
                              {new Date(
                                room.messages[0].timestamp
                              ).toLocaleTimeString()}
                              )
                            </p>
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">
                                {room.messages[0].sender?.name || "Unknown"}:
                              </span>{" "}
                              {trimMessage(room.messages[0].content, 100)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 md:flex-col lg:flex-row">
                        <Button
                          onClick={() => fetchRoomMessages(room.id)}
                          className="bg-gradient-to-r from-green-500 to-teal-500 text-white hover:from-green-600 hover:to-teal-600 transition-all duration-300 flex-1 flex items-center justify-center gap-2"
                        >
                          <Eye size={16} /> View Chat
                        </Button>
                        <Button
                          onClick={() => handleDeleteRoom(room.id)}
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 flex-1 flex items-center justify-center gap-2"
                        >
                          <Trash2 size={16} /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Room Messages Dialog */}
        <Dialog open={showRoomModal} onOpenChange={setShowRoomModal}>
          <DialogContent className="bg-white rounded-lg shadow-md max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-gray-800 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                Room Messages
                {selectedRoomId && (
                  <Badge className="ml-2 bg-gradient-to-r from-green-500 to-teal-500 text-white border-0">
                    ID: {selectedRoomId.substring(0, 8)}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="bg-gray-50 rounded-md p-2 text-sm">
              <p className="flex items-center gap-1 text-gray-600">
                <CircleAlert className="h-4 w-4 text-amber-500" />
                Showing conversation history in chronological order
              </p>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {selectedRoomMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                  <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                  <p>No messages in this conversation yet.</p>
                </div>
              ) : (
                <div className="space-y-3 p-2">
                  {[...selectedRoomMessages].reverse().map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg ${
                        msg.senderType === "guest"
                          ? "bg-gray-100 border-l-4 border-gray-300"
                          : msg.senderType === "agent"
                          ? "bg-green-50 border-l-4 border-green-300"
                          : "bg-blue-50 border-l-4 border-blue-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`font-medium ${
                            msg.senderType === "guest"
                              ? "text-gray-800"
                              : "text-green-600"
                          }`}
                        >
                          {msg.sender?.name || "Unknown"}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {msg.senderType}
                        </Badge>
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-gray-700 prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowRoomModal(false)}
                className="bg-gradient-to-r from-green-500 to-teal-500 text-white hover:from-green-600 hover:to-teal-600 transition-all duration-300"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Agent Confirmation Dialog */}
        <Dialog
          open={!!showDeleteAgentConfirm}
          onOpenChange={() => setShowDeleteAgentConfirm(null)}
        >
          <DialogContent className="bg-white rounded-lg shadow-md">
            <DialogHeader>
              <DialogTitle className="text-gray-800 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Confirm Agent Deletion
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">
              Are you sure you want to delete this agent? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                className="text-gray-600 border-gray-300 hover:bg-gray-100"
                onClick={() => setShowDeleteAgentConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all duration-300"
                onClick={confirmDeleteAgent}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Agent Confirmation Dialog */}
        <Dialog
          open={!!showDeleteAgentConfirm}
          onOpenChange={() => setShowDeleteAgentConfirm(null)}
        >
          <DialogContent className="bg-white rounded-lg shadow-md">
            <DialogHeader>
              <DialogTitle className="text-gray-800 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Confirm Agent Deletion
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">
              Are you sure you want to delete this agent? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                className="text-gray-600 border-gray-300 hover:bg-gray-100"
                onClick={() => setShowDeleteAgentConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all duration-300"
                onClick={confirmDeleteAgent}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Room Confirmation Dialog */}
        <Dialog
          open={!!showDeleteRoomConfirm}
          onOpenChange={() => setShowDeleteRoomConfirm(null)}
        >
          <DialogContent className="bg-white rounded-lg shadow-md">
            <DialogHeader>
              <DialogTitle className="text-gray-800 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Confirm Room Deletion
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">
              Are you sure you want to delete this room? This will remove all
              messages and disconnect users.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                className="text-gray-600 border-gray-300 hover:bg-gray-100"
                onClick={() => setShowDeleteRoomConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all duration-300"
                onClick={confirmDeleteRoom}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MaxWidthWrapper>
  );
};

export default AdminDashboard;
