/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, FormEvent, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown,
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { BUSINESS_CONFIG, config } from "../../../../config";

let socket: Socket | undefined;

interface SenderDetails {
  name: string;
  email?: string;
}

interface Message {
  id?: string;
  senderType: "guest" | "agent" | "ai" | "system";
  senderId?: string;
  content: string;
  timestamp?: string;
  guestName?: string;
  sender?: SenderDetails;
  optimistic?: boolean;
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

const StreamingIndicator = () => {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-xs italic text-gray-500 mt-1">
      Generating{".".repeat(dots)}
    </div>
  );
};

const GuestRoom: React.FC = () => {
  const params = useParams();
  const roomId = Array.isArray(params.roomId)
    ? params.roomId[0]
    : params.roomId;
  const router = useRouter();

  const [guestSession, setGuestSession] = useState<{
    name: string;
    email: string;
    roomId: string;
    guestId: string;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isSending, setIsSending] = useState(false);

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

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior,
        });
        setIsAtBottom(true);
      }, 10);
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

  const handleScroll = () => {
    if ((window as any)._scrollTimeout) {
      return;
    }
    (window as any)._scrollTimeout = setTimeout(() => {
      checkIfAtBottom();
      (window as any)._scrollTimeout = null;
    }, 100);
  };

  useEffect(() => {
    const storedSession = localStorage.getItem("guestSession");
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        if (session.roomId !== roomId) {
          router.push("/");
          return;
        }
        setGuestSession(session);
      } catch (error) {
        console.error("Error parsing guest session:", error);
        localStorage.removeItem("guestSession");
        router.push("/");
      }
    } else {
      router.push("/");
    }
  }, [roomId, router]);

  useEffect(() => {
    if (!guestSession) return;

    if (!socket) {
      socket = io(config.public.socketUrl || "http://localhost:5000");
    }

    socket.emit(
      "joinRoom",
      {
        roomId,
        guestId: guestSession.guestId,
        businessId: BUSINESS_CONFIG.businessId,
      },
      (error: any, response: any) => {
        if (error) console.error("Join room error:", error);
        else console.log("Joined room:", response);
      }
    );

    fetchMessages();

    socket.on("message", (message: Message & { businessId: string }) => {
      if (message.businessId === BUSINESS_CONFIG.businessId) {
        if (
          (window as any)._isStreaming &&
          message.senderType === "ai" &&
          message.content === (window as any)._streamingMessageContent
        ) {
          return;
        }

        setMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.optimistic && msg.senderId === message.senderId && msg.content === message.content
              ? { ...message, optimistic: false }
              : msg
          );
          if (!updatedMessages.some((msg) => msg.id === message.id)) {
            updatedMessages.push(message);
          }
          if (isAtBottom) setTimeout(() => scrollToBottom("auto"), 100);
          else setNewMessageCount((prev) => prev + 1);
          return updatedMessages;
        });

        if (message.senderType === "ai") setIsAITyping(false);
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
          if (data.senderType === "agent") {
            setTypingUsers((prev) => {
              if (!prev.includes(data.name)) return [...prev, data.name];
              return prev;
            });
            setTimeout(
              () =>
                setTypingUsers((prev) => prev.filter((n) => n !== data.name)),
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
        }
      }
    );

    scrollToBottom("auto");
    const scrollArea = scrollRef.current;
    if (scrollArea) {
      scrollArea.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", checkIfAtBottom);
      window.addEventListener("orientationchange", checkIfAtBottom);
    }
    return () => {
      socket?.off("message");
      socket?.off("notification");
      socket?.off("typing");
      socket?.off("toggleAI");
      if (guestSession)
        socket?.emit("leaveRoom", {
          roomId,
          guestId: guestSession.guestId,
          businessId: BUSINESS_CONFIG.businessId,
        });
      socket?.disconnect();
      socket = undefined;
      if (scrollArea) {
        scrollArea.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("resize", checkIfAtBottom);
      window.removeEventListener("orientationchange", checkIfAtBottom);
      if ((window as any)._scrollTimeout) {
        clearTimeout((window as any)._scrollTimeout);
      }
    };
  }, [roomId, guestSession]);

  useEffect(() => {
    if (isAtBottom && messages.length > 0) scrollToBottom("smooth");
  }, [messages, typingUsers, isAITyping]);

  const handleAISend = async (guestContent: string) => {
    if (!roomId || !guestSession || !isAIEnabled) return;
    setIsAITyping(true);

    const streamingMessageId = `ai-msg-${Date.now()}`;

    try {
      const response = await fetch("https://genistud.io/api/message", {
        method: "POST",
        body: JSON.stringify({
          chatbotId: config.public.chatbotId,
          email: guestSession.email || "guest@example.com",
          message: guestContent,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value, { stream: true });
      }

      const aiMessage = {
        id: streamingMessageId,
        senderType: "ai" as const,
        senderId: "ai-bot",
        content: fullResponse,
        timestamp: new Date().toISOString(),
      };

      (window as any)._isStreaming = true;
      (window as any)._streamingMessageContent = fullResponse;

      setMessages((prev) => [...prev, { ...aiMessage, content: "" }]);

      setTimeout(() => scrollToBottom("smooth"), 50);

      socket?.emit(
        "sendMessage",
        { roomId, ...aiMessage, businessId: BUSINESS_CONFIG.businessId },
        (error: any) => {
          if (error) console.error("Error sending AI message:", error);
        }
      );

      const wasAtBottomBeforeStreaming = isAtBottom;
      let shouldAutoScroll = wasAtBottomBeforeStreaming;

      let accumulatedResponse = "";
      const words = fullResponse.split(/(\s+)/);

      for (let i = 0; i < words.length; i++) {
        accumulatedResponse += words[i];

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingMessageId
              ? { ...msg, content: accumulatedResponse }
              : msg
          )
        );

        if (shouldAutoScroll) {
          scrollToBottom("auto");
        }

        if (scrollRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 20;
        }

        const delay = Math.random() * 90 + 70;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (wasAtBottomBeforeStreaming) {
        setTimeout(() => scrollToBottom("smooth"), 100);
      }

      setTimeout(() => {
        (window as any)._isStreaming = false;
        (window as any)._streamingMessageContent = null;
      }, 500);
    } catch (error) {
      console.error("Error in AI streaming:", error);
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== streamingMessageId)
      );

      socket?.emit("sendMessage", {
        roomId,
        senderType: "system",
        content: "Error receiving AI response. Please try again.",
        businessId: BUSINESS_CONFIG.businessId,
      });
    } finally {
      setIsAITyping(false);
    }
  };

  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      scrollToBottom("smooth");
    }

    if (!isAtBottom && !(window as any)._isStreaming) {
      setNewMessageCount((prev) => prev + (messages.length > 0 ? 1 : 0));
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.senderType === "guest" && !isAITyping && isAIEnabled) {
        handleAISend(lastMessage.content);
      }
    }
  }, [messages, isAIEnabled]);

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId || !guestSession || !socket || isSending)
      return;
    setIsSending(true);

    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      senderType: "guest",
      senderId: guestSession.guestId,
      content: input,
      timestamp: new Date().toISOString(),
      guestName: guestSession.name,
      optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");
    scrollToBottom("smooth");

    const payload: Message = {
      senderType: "guest",
      senderId: guestSession.guestId,
      content: input,
      timestamp: new Date().toISOString(),
      guestName: guestSession.name,
    };

    socket.emit(
      "sendMessage",
      { roomId, ...payload, businessId: BUSINESS_CONFIG.businessId },
      (err: any, response: any) => {
        setIsSending(false);
        if (err) {
          console.error("Error sending message:", err);
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== optimisticMessage.id)
          );
          socket.emit("sendMessage", {
            roomId,
            senderType: "system",
            content: "Failed to send message. Please try again.",
            businessId: BUSINESS_CONFIG.businessId,
          });
        } else {
          inputRef.current?.focus();
        }
      }
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (socket && guestSession && e.target.value.trim().length > 0) {
      socket.emit("typing", {
        roomId,
        senderType: "guest",
        name: guestSession.name,
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
          onClick={() => router.push("/chat")}
          className="text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>
        <div className="flex items-center">
          <div
            className={`bg-${BUSINESS_CONFIG.theme.primaryColor.replace(
              "600",
              "50"
            )} p-2 rounded-full mr-2`}
          >
            <MessageSquare
              size={18}
              className={`text-${BUSINESS_CONFIG.theme.primaryColor}`}
            />
          </div>
          <h1 className="font-medium text-gray-800">
            {BUSINESS_CONFIG.name} Support
          </h1>
        </div>
        <div className="w-10"></div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ScrollArea
          ref={scrollRef}
          className="h-full w-full p-4"
          onScroll={checkIfAtBottom}
        >
          <div className="max-w-3xl mx-auto w-full space-y-6 pb-20">
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
                  <MessageSquare className="h-8 w-8 text-${BUSINESS_CONFIG.theme.primaryColor}" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  Start the conversation
                </h3>
                <p className="mt-2 text-sm text-gray-500 max-w-md">
                  Send a message to begin chatting with our support team and AI
                  assistant.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex ${
                    msg.senderType === "guest" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.senderType === "guest"
                        ? "bg-white border border-gray-200 text-blue-800 rounded-br-none"
                        : msg.senderType === "ai"
                        ? "bg-gray-50 border border-gray-200 text-gray-800 rounded-tl-none"
                        : msg.senderType === "system"
                        ? "bg-amber-50 border border-amber-200 text-amber-800 rounded-tl-none"
                        : "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
                    } ${msg.optimistic ? "opacity-75" : ""}`}
                  >
                    {msg.senderType !== "guest" && (
                      <div
                        className={`text-xs font-medium mb-1 ${
                          msg.senderType === "ai"
                            ? `text-${BUSINESS_CONFIG.theme.primaryColor}`
                            : msg.senderType === "system"
                            ? "text-amber-600"
                            : "text-gray-700"
                        }`}
                      >
                        {msg.sender?.name ||
                          (msg.senderType === "ai"
                            ? "AI Assistant"
                            : msg.senderType === "system"
                            ? "System"
                            : "Agent")}
                      </div>
                    )}
                    {msg.senderType === "ai" ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {idx === messages.length - 1 &&
                          msg.senderType === "ai" &&
                          (window as any)._isStreaming &&
                          msg.content !==
                            (window as any)._streamingMessageContent && (
                            <StreamingIndicator />
                          )}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                    {msg.timestamp && (
                      <div
                        className={`text-xs mt-1 text-right ${
                          msg.senderType === "guest"
                            ? "text-blue-600"
                            : "text-gray-400"
                        }`}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    )}
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
            {typingUsers.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-white border border-gray-200 rounded-xl rounded-tl-none px-4 py-3">
                  <div className="text-xs font-medium mb-1 text-gray-700">
                    {typingUsers.join(", ")} is typing...
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
                placeholder="Message..."
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
                "AI assistant is enabled"
              ) : (
                <span className="flex items-center justify-center text-amber-600">
                  <AlertCircle size={14} className="mr-1" />
                  AI assistant is disabled - only agents will respond
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {!isAtBottom && newMessageCount > 0 && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className={`fixed right-8 bottom-24 bg-${BUSINESS_CONFIG.theme.primaryColor} text-blue-800 rounded-full p-3 shadow-lg hover:bg-${BUSINESS_CONFIG.theme.hoverColor} transition-colors`}
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

export default GuestRoom;

// TODO: would later have to create one components for all chat