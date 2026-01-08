"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

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
        <Link href="/" className="flex items-center space-x-2">
          <img 
            src="/hoa-logo.jpeg" 
            alt="HOA Logo" 
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-purple-600 text-transparent bg-clip-text transition-all duration-300 hover:from-purple-500 hover:to-rose-500">
            HOA
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center space-x-6">
          <Link
            href="/login"
            className="font-medium text-gray-600 hover:text-rose-600 transition-colors duration-300"
          >
            Provider Portal
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
            href="/login"
            className="px-3 py-2 rounded-md text-gray-700 hover:bg-rose-50 hover:text-rose-600 transition-colors duration-300"
            onClick={() => setIsOpen(false)}
          >
            Provider Portal
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
