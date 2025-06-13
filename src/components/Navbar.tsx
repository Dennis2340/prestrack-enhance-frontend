"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BUSINESS_CONFIG } from "../../config";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
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
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-teal-400 text-transparent bg-clip-text transition-all duration-300 hover:from-teal-500 hover:to-green-500">
            {BUSINESS_CONFIG.name}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center space-x-6">
          <Link
            href="/chat"
            className="font-medium text-gray-600 hover:text-teal-600 transition-colors duration-300"
          >
            Chat as Guest
          </Link>
          <Link
            href="/agent/login"
            className="font-medium text-gray-600 hover:text-green-600 transition-colors duration-300"
          >
            Agent Login
          </Link>
          <Link
            href="/api/auth/login"
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium rounded-md hover:from-green-600 hover:to-teal-600 transition-all duration-300 shadow-sm hover:shadow"
          >
            Admin Login
          </Link>
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
            href="/chat"
            className="px-3 py-2 rounded-md text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors duration-300"
            onClick={() => setIsOpen(false)}
          >
            Chat as Guest
          </Link>
          <Link
            href="/agent/login"
            className="px-3 py-2 rounded-md text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-300"
            onClick={() => setIsOpen(false)}
          >
            Agent Login
          </Link>
          <Link
            href="/api/auth/login"
            className="px-3 py-2 rounded-md bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium text-center hover:from-green-600 hover:to-teal-600 transition-all duration-300 shadow-sm"
            onClick={() => setIsOpen(false)}
          >
            Admin Login
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
