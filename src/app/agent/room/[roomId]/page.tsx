/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, FormEvent, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown,
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  Heart,
  FileText,
  Bot,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { BUSINESS_CONFIG, config } from "../../../../../config";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CollapsibleContent } from "@radix-ui/react-collapsible";

interface Message {
  id?: string;
  roomId: string;
  senderType: "guest" | "agent" | "ai" | "system";
  senderId: string | null;
  content: string;
  timestamp: string;
  guestName?: string;
  sender?: {
    name: string;
    email?: string;
  };
}

interface AiResponse {
  id: string;
  roomId: string;
  content: string;
  timestamp: string;
}

const LoadingDots = () => (
  <div className="flex space-x-2">
    <div
      className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
      style={{ animationDelay: "0ms" }}
    />
    <div
      className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
      style={{ animationDelay: "150ms" }}
    />
    <div
      className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
      style={{ animationDelay: "300ms" }}
    />
  </div>
);

const AgentRoom: React.FC = () => {
  const { roomId } = useParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [aiResponses, setAiResponses] = useState<AiResponse[]>([]);
  const [input, setInput] = useState<string>("");
  const [currentAgent, setCurrentAgent] = useState<{
    agentId: string;
    name: string;
    email?: string;
  } | null>(null);
  const [medicalData, setMedicalData] = useState<any>(null);
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [agentTyping, setAgentTyping] = useState<string[]>([]);
  const [guestTyping, setGuestTyping] = useState<string[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/rooms/${roomId}?businessId=${BUSINESS_CONFIG.businessId}`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      } else {
        console.error("Failed to fetch messages for room.");
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const fetchMedicalData = async () => {
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/medical?businessId=${BUSINESS_CONFIG.businessId}`
      );
      if (res.ok) {
        const data = await res.json();
        setMedicalData(data);
      } else {
        console.error("Failed to fetch medical data.");
      }
    } catch (error) {
      console.error("Error fetching medical data:", error);
    }
  };

  const fetchAiResponses = async () => {
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/ai/responses?businessId=${BUSINESS_CONFIG.businessId}`
      );
      if (res.ok) {
        const data = await res.json();
        setAiResponses(data);
      } else {
        console.error("Failed to fetch AI responses.");
      }
    } catch (error) {
      console.error("Error fetching AI responses:", error);
    }
  };

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const checkIfAtBottom = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 20;
      setIsAtBottom(isBottom);
      if (isBottom) setNewMessageCount(0);
    }
  };

  useEffect(() => {
    const storedAgent = localStorage.getItem("currentAgent");
    if (storedAgent) {
      setCurrentAgent(JSON.parse(storedAgent));
    } else {
      router.push("/agent/login");
    }
  }, [router]);

  const [roomData, setRoomData] = useState<any>(null);

  useEffect(() => {
    if (!currentAgent || !roomId) return;

    const fetchRoomData = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}?businessId=${BUSINESS_CONFIG.businessId}`
        );
        if (res.ok) {
          const data = await res.json();
          setRoomData(data);
          fetchMedicalData();
          fetchAiResponses();
        }
      } catch (error) {
        console.error("Error fetching room data:", error);
      }
    };

    fetchRoomData();

    const socket = io(config.public.socketUrl || "http://localhost:5000", {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit(
        "joinRoom",
        {
          roomId,
          agentId: currentAgent.agentId,
          businessId: BUSINESS_CONFIG.businessId,
        },
        (error: any, response: any) => {
          if (error) {
            console.error("Join room error:", error);
          } else {
            console.log("Joined room:", response);
            fetchMessages();
          }
        }
      );
    });

    socket.on("message", (message: Message & { businessId: string }) => {
      if (message.businessId === BUSINESS_CONFIG.businessId) {
        setMessages((prev) => {
          const newMessages = [...prev, message];
          if (isAtBottom) setTimeout(() => scrollToBottom("auto"), 100);
          else setNewMessageCount((prev) => prev + 1);
          return newMessages;
        });
      }
    });

    socket.on(
      "notification",
      (data: { message: string; businessId: string }) => {
        if (data.businessId === BUSINESS_CONFIG.businessId) {
          setMessages((prev) => [
            ...prev,
            {
              senderType: "system",
              content: data.message,
              senderId: "system",
              roomId: String(roomId),
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    );

    socket.on(
      "typing",
      (data: {
        roomId: string;
        senderType: string;
        name: string;
        businessId: string;
      }) => {
        if (
          data.roomId === roomId &&
          data.businessId === BUSINESS_CONFIG.businessId
        ) {
          if (data.senderType === "guest") {
            setGuestTyping((prev) => {
              if (!prev.includes(data.name)) return [...prev, data.name];
              return prev;
            });
            setTimeout(
              () =>
                setGuestTyping((prev) => prev.filter((n) => n !== data.name)),
              3000
            );
          } else if (
            data.senderType === "agent" &&
            data.name !== currentAgent.name
          ) {
            setAgentTyping((prev) => {
              if (!prev.includes(data.name)) return [...prev, data.name];
              return prev;
            });
            setTimeout(
              () =>
                setAgentTyping((prev) => prev.filter((n) => n !== data.name)),
              3000
            );
          } else if (data.senderType === "ai") {
            setIsAITyping(true);
            setTimeout(() => setIsAITyping(false), 3000);
          }
        }
      }
    );

    socket.on(
      "toggleAI",
      (data: { roomId: string; isAIEnabled: boolean; businessId: string }) => {
        if (
          data.roomId === roomId &&
          data.businessId === BUSINESS_CONFIG.businessId
        ) {
          setIsAIEnabled(data.isAIEnabled);
          console.log(
            `AI toggled to ${
              data.isAIEnabled ? "enabled" : "disabled"
            } for room ${roomId}`
          );
        }
      }
    );

    scrollToBottom("auto");
    const scrollArea = scrollRef.current;
    if (scrollArea) scrollArea.addEventListener("scroll", checkIfAtBottom);

    return () => {
      socket.off("connect");
      socket.off("message");
      socket.off("typing");
      socket.off("toggleAI");
      socket.off("notification");
      if (currentAgent)
        socket.emit("leaveRoom", {
          roomId,
          agentId: currentAgent.agentId,
          businessId: BUSINESS_CONFIG.businessId,
        });
      socket.disconnect();
      socketRef.current = null;
      if (scrollArea) scrollArea.removeEventListener("scroll", checkIfAtBottom);
    };
  }, [roomId, currentAgent]);

  useEffect(() => {
    if (isAtBottom && messages.length > 0) scrollToBottom("smooth");
  }, [messages, agentTyping, guestTyping, isAITyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (socketRef.current && currentAgent && e.target.value.trim().length > 0) {
      socketRef.current.emit("typing", {
        roomId,
        senderType: "agent",
        name: currentAgent.name,
        businessId: BUSINESS_CONFIG.businessId,
      });
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId || !currentAgent || isSending) return;

    setIsSending(true);

    if (isAIEnabled) {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/ai/conversation?businessId=${BUSINESS_CONFIG.businessId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: input,
              patientId: roomData?.guestId,
            }),
          }
        );

        if (res.ok) {
          setInput("");
          await fetchAiResponses();
        } else {
          console.error("Failed to send message to AI.");
        }
      } catch (error) {
        console.error("Error sending message to AI:", error);
      } finally {
        setIsSending(false);
        inputRef.current?.focus();
      }
    } else {
      if (!socketRef.current) {
        setIsSending(false);
        return;
      }
      const messagePayload: any = {
        roomId: String(roomId),
        senderType: "agent",
        senderId: currentAgent.agentId,
        content: input,
        timestamp: new Date().toISOString(),
        businessId: BUSINESS_CONFIG.businessId,
        sender: {
          name: currentAgent.name,
          email: currentAgent.email,
        },
      };

      setInput("");
      socketRef.current.emit("sendMessage", messagePayload, (error: any) => {
        setIsSending(false);
        if (error) console.error("Error sending message:", error);
        else inputRef.current?.focus();
      });
    }
  };

  const handleAIToggle = (checked: boolean) => {
    setIsAIEnabled(checked);
    if (socketRef.current && roomId) {
      socketRef.current.emit("toggleAI", {
        roomId,
        isAIEnabled: checked,
        businessId: BUSINESS_CONFIG.businessId,
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Button
          variant="ghost"
          onClick={() => router.push("/agent")}
          className="text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-4">
          <div
            className={`bg-${BUSINESS_CONFIG.theme.primaryColor.replace(
              "600",
              "50"
            )} p-2 rounded-full mr-2`}
          >
            <Heart
              size={18}
              className={`text-${BUSINESS_CONFIG.theme.primaryColor}`}
            />
          </div>
          <div className="flex flex-col">
            <h1 className="font-medium text-gray-800">
              Doctor's Consultation Room
            </h1>
            <p className="text-sm text-gray-600">
              Patient: {messages[0]?.guestName || "Unknown Patient"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-gray-200">
          <Switch
            id="ai-mode"
            checked={isAIEnabled}
            onCheckedChange={handleAIToggle}
          />
          <span
            className={`text-sm font-medium ${
              isAIEnabled
                ? `text-${BUSINESS_CONFIG.theme.primaryColor}`
                : "text-gray-600"
            }`}
          >
            AI {isAIEnabled ? "On" : "Off"}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ScrollArea
          ref={scrollRef}
          className="h-full w-full p-4"
          onScroll={checkIfAtBottom}
        >
          <div className="max-w-3xl mx-auto w-full space-y-6 pb-20">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">
                    Patient Medical Data
                  </span>
                </div>
                <ChevronDown className="h-5 w-5 text-gray-500" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                {medicalData ? (
                  <pre className="text-sm text-gray-700">
                    {JSON.stringify(medicalData, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500">
                    No medical data available.
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Bot className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">
                    Doctor AI Assistant Responses
                  </span>
                </div>
                <ChevronDown className="h-5 w-5 text-gray-500" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                {aiResponses.length > 0 ? (
                  <div className="space-y-4">
                    {aiResponses.map((response) => (
                      <div
                        key={response.id}
                        className="border-b border-gray-100 pb-2"
                      >
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{response.content}</ReactMarkdown>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          {formatTime(response.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No doctor AI responses yet.
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {isLoadingMessages ? (
              <div className="flex flex-col items-center justify-center h-64">
                <LoadingDots />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div
                  className={`bg-${BUSINESS_CONFIG.theme.primaryColor.replace(
                    "600",
                    "50"
                  )} p-4 rounded-full mb-4`}
                >
                  <MessageSquare
                    className={`h-8 w-8 text-${BUSINESS_CONFIG.theme.primaryColor}`}
                  />
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  No messages yet
                </h3>
                <p className="mt-2 text-sm text-gray-500 max-w-md">
                  Wait for the guest to send a message or start the conversation.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.senderType === "guest" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.senderType === "guest"
                        ? "bg-white border border-gray-200 text-blue-800 rounded-bl-none"
                        : msg.senderType === "agent" &&
                          msg.senderId === currentAgent?.agentId
                        ? "bg-white border border-gray-200 rounded-tr-none"
                        : msg.senderType === "ai"
                        ? "bg-gray-50 border border-gray-200 rounded-tl-none"
                        : msg.senderType === "system"
                        ? "bg-amber-50 border border-amber-200 text-amber-800 rounded-tl-none"
                        : "bg-gray-100 border border-gray-200 rounded-tl-none"
                    }`}
                  >
                    {(msg.senderType === "guest" ||
                      msg.senderType === "ai" ||
                      msg.senderType === "system" ||
                      (msg.senderType === "agent" &&
                        msg.senderId !== currentAgent?.agentId)) && (
                      <div
                        className={`text-xs font-medium mb-1 ${
                          msg.senderType === "guest"
                            ? "text-blue-800"
                            : msg.senderType === "ai"
                            ? `text-${BUSINESS_CONFIG.theme.primaryColor}`
                            : msg.senderType === "system"
                            ? "text-amber-600"
                            : "text-gray-700"
                        }`}
                      >
                        {msg.senderType === "guest"
                          ? msg.guestName || "Guest"
                          : msg.senderType === "ai"
                          ? "AI Assistant"
                          : msg.senderType === "system"
                          ? "System"
                          : msg.sender?.name || "Agent"}
                      </div>
                    )}

                    {msg.senderType === "ai" ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}

                    <div
                      className={`text-xs mt-1 text-right ${
                        msg.senderType === "guest"
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}

            {isAITyping && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-gray-50 border border-gray-200 rounded-xl rounded-tl-none px-4 py-3">
                  <div
                    className={`text-xs font-medium mb-1 text-${BUSINESS_CONFIG.theme.primaryColor}`}
                  >
                    AI Assistant
                  </div>
                  <LoadingDots />
                </div>
              </div>
            )}

            {guestTyping.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-white border border-gray-200 rounded-xl rounded-tl-none px-4 py-3">
                  <div className="text-xs font-medium mb-1 text-gray-700">
                    {guestTyping.join(", ")} is typing...
                  </div>
                  <LoadingDots />
                </div>
              </div>
            )}

            {agentTyping.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-gray-100 border border-gray-200 rounded-xl rounded-tl-none px-4 py-3">
                  <div className="text-xs font-medium mb-1 text-gray-700">
                    Agent {agentTyping.join(", ")} is typing...
                  </div>
                  <LoadingDots />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-3xl mx-auto w-full px-4 py-4">
          <form onSubmit={handleSendMessage} className="relative">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                className="w-full min-h-[60px] max-h-[200px] rounded-xl py-4 px-5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm pr-16 resize-none"
                value={input}
                onChange={handleInputChange}
                placeholder={
                  isAIEnabled
                    ? "Interact with AI Assistant"
                    : "Type your message to the patient"
                }
                disabled={isSending}
                style={{
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isSending}
                className={`absolute right-2 bottom-2 h-10 w-10 p-0 bg-${BUSINESS_CONFIG.theme.primaryColor} hover:bg-${BUSINESS_CONFIG.theme.hoverColor} rounded-lg transition-colors`}
                style={{
                  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
                }}
              >
                {isSending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-2 text-center">
              {isAIEnabled ? (
                <span className="flex items-center justify-center text-green-600">
                  AI assistant is enabled - interacting with AI
                </span>
              ) : (
                "AI assistant is disabled - messaging patient directly"
              )}
            </div>
          </form>
        </div>
      </div>

      {!isAtBottom && newMessageCount > 0 && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className={`fixed right-8 bottom-24 bg-${BUSINESS_CONFIG.theme.primaryColor} text-white rounded-full p-3 shadow-lg hover:bg-${BUSINESS_CONFIG.theme.hoverColor} transition-colors`}
        >
          <div className="flex items-center">
            <ChevronDown size={18} className="mr-1" />
            <span className="text-sm">{newMessageCount} new</span>
          </div>
        </button>
      )}
    </div>
  );
};

export default AgentRoom;