// eslint-disable-next-line @typescript-eslint/no-unused-vars
"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { BUSINESS_CONFIG } from "../../config";
import {
  LogOut,
  LayoutDashboard,
  Headphones,
  Menu,
  X,
  Bell,
  Clock,
  Check,
  CheckCircle,
  Archive,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Notification } from "@prisma/client";
interface Agent {
  agentId: string;
  name: string;
}
const AgentNavbar = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [agentName, setAgentName] = useState(null);
  const [initials, setInitials] = useState("AG");
  const [activeChats, setActiveChats] = useState(0);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    const storedAgent = localStorage.getItem("currentAgent");
    if (storedAgent) {
      try {
        setCurrentAgent(JSON.parse(storedAgent));

        console.log("User: ", storedAgent);
      } catch (error) {
        console.error("Error parsing currentAgent:", error);
        router.push("/agent/login");
      }
    } else {
      router.push("/agent/login");
    }
  }, [router]);

  useEffect(() => {
    const getNotifications = async () => {
      try {
        const response = await fetch(
          `/api/notifications/?agentId=${currentAgent?.agentId}`
        );

        const data = await response.json();

        console.log("Notifications: ", data);
        setNotifications(data.notifications);
      } catch (error) {
        console.log(error);
      }
    };

    getNotifications();
  }, []);

  const unreadCount = notifications.filter(
    (n) => currentAgent?.agentId && !n.read.includes(currentAgent?.agentId)
  ).length;

  const markAsRead = async (id: string) => {
    if (!currentAgent?.agentId) return;

    try {
      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.read.includes(currentAgent.agentId)
            ? { ...n, read: [...n.read, currentAgent.agentId] }
            : n
        )
      );

      // API call to update the server
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationsId: [id],
          agentId: currentAgent.agentId,
        }),
      });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Revert optimistic update if the API call fails
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, read: n.read.filter((id) => id !== currentAgent.agentId) }
            : n
        )
      );
    }
  };

  const markAllAsRead = async () => {
    if (!currentAgent?.agentId) return;

    try {
      // Get all unread notification IDs
      const unreadIds = notifications
        .filter((n) => !n.read.includes(currentAgent.agentId))
        .map((n) => n.id);

      if (unreadIds.length === 0) return;

      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) =>
          !n.read.includes(currentAgent.agentId)
            ? { ...n, read: [...n.read, currentAgent.agentId] }
            : n
        )
      );

      // API call to update the server
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationsId: unreadIds,
          agentId: currentAgent.agentId,
        }),
      });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      // Revert optimistic update if the API call fails
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: n.read.filter((id) => id !== currentAgent.agentId),
        }))
      );
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);

    try {
      const session = localStorage.getItem("currentAgent");
      if (session) {
        const { name } = JSON.parse(session);
        setAgentName(name);

        // Generate initials from name
        if (name) {
          const nameParts = name.split(" ");
          const initials =
            nameParts.length > 1
              ? `${nameParts[0][0]}${nameParts[1][0]}`
              : name.substring(0, 2);
          setInitials(initials.toUpperCase());
        }
      }
    } catch (error) {
      console.error("Error reading agent session:", error);
    }

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("agentSession");
    localStorage.removeItem("currentAgent");
    router.push("/agent/login");
  };

  return (
    <nav
      className={`sticky h-16 inset-x-0 top-0 z-30 w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-sm shadow-md border-b border-gray-100"
          : "bg-white border-b border-gray-200"
      }`}
    >
      <div className="h-full px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl flex items-center justify-between">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center group">
          <div className="mr-2 transition-transform duration-300 group-hover:scale-105">
            <Headphones className="h-5 w-5 text-green-600" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-teal-400 text-transparent bg-clip-text transition-all duration-300 hover:from-teal-500 hover:to-green-500">
            {BUSINESS_CONFIG.name}
            <span className="ml-1.5 text-sm font-medium bg-gradient-to-r from-green-600 to-teal-400 text-white px-2 py-0.5 rounded">
              Agent Portal
            </span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center space-x-4">
          {/* Dashboard Button */}
          {agentName && (
            <Link
              href="/agent"
              className="font-medium text-gray-600 hover:text-teal-600 transition-colors duration-300"
            >
              <div className="flex items-center">
                <LayoutDashboard className="h-4 w-4 mr-1.5" />
                Dashboard
              </div>
            </Link>
          )}

          {/* Status Indicators */}
          {agentName && (
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-green-400 mr-2 animate-pulse"></div>
              <span className="text-sm font-medium text-gray-600">Online</span>
            </div>
          )}

          {activeChats > 0 && (
            <div className="flex items-center text-gray-600">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                {activeChats} Active {activeChats === 1 ? "Chat" : "Chats"}
              </span>
            </div>
          )}

          {/* TODO: move this into a separate file */}

          {/* Notifications */}
          {agentName && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-gray-700" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-gradient-to-r from-green-500 to-teal-400 text-white rounded-full text-xs flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0 rounded-lg border border-gray-200 shadow-lg"
                align="end"
              >
                <Card className="border-0 shadow-none overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 bg-gradient-to-r from-green-100 to-teal-100">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg font-semibold flex items-center">
                        <span className="bg-gradient-to-r from-green-600 to-teal-400 text-transparent bg-clip-text">
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <div className="ml-2 h-5 w-5 bg-gradient-to-r from-green-500 to-teal-400 rounded-full text-white text-xs flex items-center justify-center">
                            {unreadCount}
                          </div>
                        )}
                      </CardTitle>
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={markAllAsRead}
                          className="text-xs h-8 hover:bg-white/20 text-teal-600"
                        >
                          Mark all as read
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {/* Tabs for All/Unread/Read */}
                  <div className="border-b border-gray-200">
                    <div className="flex">
                      <button
                        onClick={() => setActiveTab("all")}
                        className={`flex-1 py-2 text-sm font-medium text-center ${
                          activeTab === "all"
                            ? "text-teal-600 border-b-2 border-teal-500"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setActiveTab("unread")}
                        className={`flex-1 py-2 text-sm font-medium text-center ${
                          activeTab === "unread"
                            ? "text-teal-600 border-b-2 border-teal-500"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Unread {unreadCount > 0 && `(${unreadCount})`}
                      </button>
                      <button
                        onClick={() => setActiveTab("read")}
                        className={`flex-1 py-2 text-sm font-medium text-center ${
                          activeTab === "read"
                            ? "text-teal-600 border-b-2 border-teal-500"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Read
                      </button>
                    </div>
                  </div>

                  <CardContent className="p-0 max-h-[300px] overflow-auto">
                    {(() => {
                      // Check if current agent has read a notification
                      const hasAgentReadNotification = (notification: {
                        id: string;
                        title: string;
                        description: string;
                        time: string;
                        read: string[];
                        createdAt: Date;
                        updatedAt: Date;
                        roomId: string | null;
                      }) => {
                        return (
                          notification.read &&
                          notification.read.includes(
                            currentAgent?.agentId as string
                          )
                        );
                      };

                      // Filter notifications based on active tab
                      const filteredNotifications = notifications.filter(
                        (notification) => {
                          if (activeTab === "all") return true;
                          if (activeTab === "unread")
                            return !hasAgentReadNotification(notification);
                          if (activeTab === "read")
                            return hasAgentReadNotification(notification);
                          return true;
                        }
                      );

                      if (filteredNotifications.length > 0) {
                        return (
                          <div className="divide-y divide-gray-100">
                            {filteredNotifications.map((notification) => {
                              const isRead =
                                hasAgentReadNotification(notification);

                              return (
                                <div
                                  key={notification.id}
                                  className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer relative ${
                                    !isRead
                                      ? "bg-gradient-to-r from-green-100 to-teal-100"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    // Add current agent ID to the read array
                                    markAsRead(notification.id);
                                    if (notification.roomId) {
                                      router.push(
                                        `/agent/room/${notification.roomId}`
                                      );
                                    }
                                  }}
                                >
                                  {!isRead && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-teal-400"></div>
                                  )}
                                  <div className="flex justify-between items-start mb-1">
                                    <div className="font-medium text-sm flex items-center">
                                      {notification.title}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {/* Read/Unread Status indicator */}
                                      {isRead ? (
                                        <div className="text-xs text-gray-500 flex items-center">
                                          <Check className="h-3 w-3 mr-1" />
                                        </div>
                                      ) : (
                                        <div className="text-xs text-teal-500 flex items-center">
                                          <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse"></div>
                                        </div>
                                      )}

                                      {/* Priority Badge */}
                                      <Badge
                                        variant={
                                          notification.priority === "HIGH"
                                            ? "destructive"
                                            : notification.priority === "MID"
                                            ? "default"
                                            : "outline"
                                        }
                                        className={`text-xs ${
                                          notification.priority === "HIGH"
                                            ? "bg-red-600 text-white border-0"
                                            : notification.priority === "MID"
                                            ? "bg-gradient-to-r from-green-500 to-teal-400 border-0 text-white"
                                            : "border-green-300 text-green-600"
                                        }`}
                                      >
                                        {notification.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-1">
                                    {notification.description}
                                  </p>
                                  <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500 flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {notification.time}
                                    </p>
                                    {!isRead && (
                                      <div className="text-xs text-teal-500 flex items-center font-medium">
                                        New
                                      </div>
                                    )}
                                    {notification.read &&
                                      notification.read.length > 0 && (
                                        <div className="text-xs text-gray-500">
                                          Read by {notification.read.length}{" "}
                                          {notification.read.length === 1
                                            ? "agent"
                                            : "agents"}
                                        </div>
                                      )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // Empty state for current tab
                        return (
                          <div className="py-8 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-r from-green-100 to-teal-100 flex items-center justify-center mb-3">
                              {activeTab === "unread" ? (
                                <CheckCircle className="h-6 w-6 text-teal-500" />
                              ) : activeTab === "read" ? (
                                <Archive className="h-6 w-6 text-teal-500" />
                              ) : (
                                <Bell className="h-6 w-6 text-teal-500" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {activeTab === "unread"
                                ? "All caught up!"
                                : activeTab === "read"
                                ? "No read notifications"
                                : "No notifications yet"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {activeTab === "unread"
                                ? "You've read all your notifications"
                                : activeTab === "read"
                                ? "Your read notifications will appear here"
                                : "We'll notify you when something important happens"}
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </CardContent>
                  <CardFooter className="p-2 border-t bg-gradient-to-r from-green-50 to-teal-50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-sm bg-gradient-to-r from-green-600 to-teal-400 text-transparent bg-clip-text hover:bg-green-100"
                    >
                      View all notifications
                    </Button>
                  </CardFooter>
                </Card>
              </PopoverContent>
            </Popover>
          )}

          {/* Agent Profile Dropdown */}
          {agentName && (
            <>
              <Button
                variant="ghost"
                className="hover:bg-gray-100 transition-colors duration-300 flex items-center gap-2"
              >
                <Avatar className="h-8 w-8 border-2 border-green-100">
                  <AvatarFallback className="bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700 line-clamp-1">
                    {agentName}
                  </p>
                  <p className="text-xs text-gray-500">Support Agent</p>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={handleLogout}
                className="bg-gradient-to-r from-green-500 to-teal-500 text-white border-0 hover:from-green-600 hover:to-teal-600 transition-all duration-300"
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Logout
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="sm:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <X className="h-6 w-6 text-gray-700" />
          ) : (
            <Menu className="h-6 w-6 text-gray-700" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`absolute top-16 left-0 w-full bg-white border-b border-gray-200 shadow-md sm:hidden transition-all duration-300 transform ${
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="flex flex-col p-4 space-y-4">
          {agentName && (
            <Link
              href="/agent"
              className="px-3 py-2 rounded-md text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors duration-300 flex items-center"
              onClick={() => setIsOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          )}

          {/* Notifications for mobile view */}
          {agentName && (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-700 flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 hover:bg-gray-100 text-gray-600"
                    onClick={markAllAsRead}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                {notifications.slice(0, 2).map((notification) => (
                  <div
                    key={notification.id}
                    className={`py-2 text-sm ${
                      !notification.read ? "font-medium" : ""
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-gray-800">
                        {notification.title}
                      </span>
                      <Badge
                        variant={
                          notification.priority === "HIGH"
                            ? "destructive"
                            : notification.priority === "MID"
                            ? "default"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {notification.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.description}
                    </p>
                  </div>
                ))}
                {notifications.length > 2 && (
                  <div className="py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs w-full text-teal-600"
                    >
                      View all ({notifications.length})
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status indicators for mobile */}
          {agentName && (
            <div className="px-3 py-2 flex items-center">
              <div className="h-2 w-2 rounded-full bg-green-400 mr-2 animate-pulse"></div>
              <span className="text-sm font-medium text-gray-600">Online</span>
            </div>
          )}

          {activeChats > 0 && (
            <div className="px-3 py-2 flex items-center text-gray-600">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                {activeChats} Active {activeChats === 1 ? "Chat" : "Chats"}
              </span>
            </div>
          )}

          {/* Profile info for mobile */}
          {agentName && (
            <div className="px-3 py-2 flex items-center">
              <Avatar className="h-8 w-8 border-2 border-green-100 mr-2">
                <AvatarFallback className="bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-700">{agentName}</p>
                <p className="text-xs text-gray-500">Support Agent</p>
              </div>
            </div>
          )}

          {agentName && (
            <button
              onClick={() => {
                handleLogout();
                setIsOpen(false);
              }}
              className="px-3 py-2 rounded-md bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium text-center hover:from-green-600 hover:to-teal-600 transition-all duration-300 shadow-sm flex items-center justify-center"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default AgentNavbar;
