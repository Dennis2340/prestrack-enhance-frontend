import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import Link from "next/link";
import { RegisterLink } from "@kinde-oss/kinde-auth-nextjs/server";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, Baby, Calendar, User, MessageCircle, Globe } from "lucide-react";
import { BUSINESS_CONFIG } from "../../config";

export default async function Home() {
  return (
    <div className="bg-gradient-to-b from-pink-50 to-purple-50">
      <Navbar />

      {/* Hero Section */}
      <MaxWidthWrapper className="mb-12 mt-28 sm:mt-40 flex flex-col items-center justify-center text-center">
        {/* Decorative background elements */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-3/4 h-3/4 bg-gradient-to-r from-pink-100/30 to-purple-100/30 rounded-full blur-3xl -z-10" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-purple-100/20 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <span className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-full text-pink-800 mb-6 inline-block">
            Comprehensive Pregnancy Care
          </span>

          <h1 className="max-w-4xl text-5xl font-bold md:text-6xl lg:text-7xl text-gray-900 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text">
            Welcome to {BUSINESS_CONFIG.name}
          </h1>

          <p className="mt-6 max-w-prose text-gray-600 sm:text-lg">
            Your trusted companion for pregnancy health and wellness
          </p>
        </div>

        {/* User Selection Cards */}
        <div className="mt-16 w-full">
          <h2 className="text-2xl font-semibold text-gray-800 mb-8">
            How can we assist you today?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Patient Card */}
            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-pink-400 to-pink-500" />
              <div className="p-6 md:p-8">
                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mb-4">
                  <Heart className="h-6 w-6 text-pink-600" />
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Patient Support
                </h3>

                <p className="text-gray-600 mb-6">
                  Get personalized pregnancy care and support
                </p>

                <Button asChild className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white">
                  <Link href="/chat">
                    Start Chatting <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Health Professional Card */}
            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-purple-400 to-purple-500" />
              <div className="p-6 md:p-8">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <User className="h-6 w-6 text-purple-600" />
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Health Professional Dashboard
                </h3>

                <p className="text-gray-600 mb-6">
                  Manage your patient interactions and health records
                </p>

                <Button asChild className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white">
                  <Link href="/agent">
                    Access Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Admin Card */}
            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-blue-400 to-blue-500" />
              <div className="p-6 md:p-8">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Baby className="h-6 w-6 text-blue-600" />
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Clinic Management
                </h3>

                <p className="text-gray-600 mb-6">
                  Manage your pregnancy clinic operations
                </p>

                <Button asChild className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white">
                  <Link href="/api/auth/register">
                    Enter Admin <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </MaxWidthWrapper>

      {/* Features Section */}
      <div className="relative py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white"></div>
        <MaxWidthWrapper className="relative">
          <div className="text-center mb-16">
            <span className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-gray-100 to-gray-200 rounded-full text-gray-700 mb-4 inline-block">
              Our Solutions
            </span>
            <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">
              Why Choose{" "}
              <span className="bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                {BUSINESS_CONFIG.name}
              </span>
              ?
            </h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              We&apos;re redefining financial management with intelligent solutions
              built for you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-teal-100/50 rounded-bl-full -z-0"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center text-white mb-6 shadow-md">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Instant Support
                </h3>
                <p className="text-gray-600">
                  Chat with our AI or human agents for quick assistance when you
                  need it most.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-100/50 rounded-bl-full -z-0"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center text-white mb-6 shadow-md">
                  <svg
                    className="h-7 w-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19 9L12 16L5 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Secure Payments
                </h3>
                <p className="text-gray-600">
                  Manage your money with confidence, advanced security, and
                  intuitive interfaces.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/50 rounded-bl-full -z-0"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white mb-6 shadow-md">
                  <Globe className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  24/7 Access
                </h3>
                <p className="text-gray-600">
                  Support and services available anytime, anywhere, on any
                  device.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Banner */}
          <div className="mt-16 bg-gradient-to-r from-teal-600 to-green-600 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-12 md:py-16 md:px-12 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              </div>

              <div className="relative">
                <h2 className="text-3xl font-bold mb-4">
                  Ready to get started?
                </h2>
                <p className="text-teal-100 mb-8 max-w-xl mx-auto">
                  Join thousands of satisfied customers using{" "}
                  {BUSINESS_CONFIG.name} for their financial needs.
                </p>
                <Link href="/chat">
                  <Button className="bg-white text-teal-700 hover:bg-teal-50 px-6 py-3">
                    Start Using {BUSINESS_CONFIG.name} Today
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </MaxWidthWrapper>
      </div>
    </div>
  );
}
