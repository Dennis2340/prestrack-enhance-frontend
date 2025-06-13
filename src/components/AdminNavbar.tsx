"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BUSINESS_CONFIG } from "../../config";
import {
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Menu,
  X,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";

type KindeUser = {
  id: string;
  email: string | null;
  family_name: string | null;
  given_name: string | null;
  picture: string | null;
  username?: string | null; // optional
  phone_number?: string | null; // optional
};

const AdminNavbar = ({ userData }: { userData: KindeUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [initials, setInitials] = useState("AD");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);

    try {
      if (userData) {
        const userName = `${userData.given_name}${userData.family_name}`;
        setAdminName(userName);

        // Generate initials from name
        if (userData.email) {
          const nameParts = userName.split(" ");
          const initials =
            nameParts.length > 1
              ? `${nameParts[0][0]}${nameParts[1][0]}`
              : userName.substring(0, 2);
          setInitials(initials.toUpperCase());
        }
      }
    } catch (error) {
      console.error("Error reading admin session:", error);
    }

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
            <ShieldCheck className="h-5 w-5 text-green-600" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-teal-400 text-transparent bg-clip-text transition-all duration-300 hover:from-teal-500 hover:to-green-500">
            {BUSINESS_CONFIG.name}
            <span className="ml-1.5 text-sm font-medium bg-gradient-to-r from-green-600 to-teal-400 text-white px-2 py-0.5 rounded">
              Admin Portal
            </span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center space-x-4">
          {/* Dashboard Button */}
          <Link
            href="/admin"
            className="font-medium text-gray-600 hover:text-teal-600 transition-colors duration-300"
          >
            <div className="flex items-center">
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Dashboard
            </div>
          </Link>

          {/* Admin Profile */}
          {adminName && (
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
                  {adminName || "Administrator"}
                </p>
                <p className="text-xs text-gray-500">System Admin</p>
              </div>
            </Button>
          )}

          <LogoutLink className="bg-gradient-to-r from-green-500 to-teal-500 text-white border-0 hover:from-green-600 hover:to-teal-600 transition-all duration-300 inline-flex items-center px-4 py-2 rounded-md text-sm font-medium">
            <LogOut className="h-4 w-4 mr-1.5" />
            Logout
          </LogoutLink>
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
          <Link
            href="/admin"
            className="px-3 py-2 rounded-md text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors duration-300 flex items-center"
            onClick={() => setIsOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Dashboard
          </Link>

          <Link
            href="/admin/agents"
            className="px-3 py-2 rounded-md text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors duration-300 flex items-center"
            onClick={() => setIsOpen(false)}
          >
            <Users className="h-4 w-4 mr-2" />
            Agents
          </Link>

          {/* Profile info for mobile */}
          {adminName && (
            <div className="px-3 py-2 flex items-center">
              <Avatar className="h-8 w-8 border-2 border-green-100 mr-2">
                <AvatarFallback className="bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {adminName || "Administrator"}
                </p>
                <p className="text-xs text-gray-500">System Admin</p>
              </div>
            </div>
          )}

          <LogoutLink className="px-3 py-2 rounded-md bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium text-center hover:from-green-600 hover:to-teal-600 transition-all duration-300 shadow-sm flex items-center justify-center">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </LogoutLink>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar;
