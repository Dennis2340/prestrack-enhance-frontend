"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { BUSINESS_CONFIG } from "../../config";
import { Home, LogOut, MessageCircle } from "lucide-react";

const GuestNavbar: React.FC = () => {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);

  useEffect(() => {
    // Handle scroll effect for navbar
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);

    // Get guest name from localStorage if available
    try {
      const session = localStorage.getItem("guestSession");
      if (session) {
        const { name } = JSON.parse(session);
        setGuestName(name);
      }
    } catch (error) {
      console.error("Error reading guest session:", error);
    }

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("guestSession");
    router.push("/");
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
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-green-600 text-transparent bg-clip-text transition-colors duration-300 hover:from-teal-500 hover:to-green-500">
            {BUSINESS_CONFIG.name}
          </span>
        </Link>

        {/* Guest status indicator - shown if guest is logged in */}
        {guestName && (
          <div className="hidden md:flex items-center bg-teal-50 px-3 py-1.5 rounded-full">
            <MessageCircle className="h-4 w-4 text-teal-600 mr-2" />
            <span className="text-sm font-medium text-teal-700 truncate max-w-xs">
              Chatting as {guestName}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="text-gray-700 hover:text-teal-600 hover:bg-teal-50 transition-colors duration-300"
            size="sm"
          >
            <Home className="h-4 w-4 mr-2 sm:mr-1.5" />
            <span className="hidden sm:inline">Home</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-300"
            size="sm"
          >
            <LogOut className="h-4 w-4 mr-2 sm:mr-1.5" />
            <span className="hidden sm:inline">Leave Chat</span>
          </Button>
        </div>
      </div>

      {/* Mobile guest status indicator - only shown on smaller screens */}
      {guestName && (
        <div className="md:hidden bg-teal-50 py-2 px-4 border-b border-teal-100 text-center">
          <span className="text-sm text-teal-700">
            Chatting as <span className="font-medium">{guestName}</span>
          </span>
        </div>
      )}
    </nav>
  );
};

export default GuestNavbar;
