import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, Calendar, Users, MessageCircle, Sparkles, Shield, Clock, Brain } from "lucide-react";

export default async function Home() {
  return (
    <div className="bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      <Navbar />

      {/* Hero Section */}
      <MaxWidthWrapper className="mb-12 mt-28 sm:mt-40 flex flex-col items-center justify-center text-center">
        {/* Decorative background elements */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-3/4 h-3/4 bg-gradient-to-r from-rose-100/40 to-purple-100/40 rounded-full blur-3xl -z-10" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-pink-100/30 rounded-full blur-3xl -z-10" />

        <div className="relative">
          <span className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-rose-500/10 to-purple-500/10 rounded-full text-rose-800 mb-6 inline-block">
            Women-Centered Wellness Hub
          </span>

          <h1 className="max-w-4xl text-5xl font-bold md:text-6xl lg:text-7xl text-gray-900 bg-gradient-to-r from-rose-600 to-purple-600 bg-clip-text">
            Welcome to HOA
          </h1>

          <p className="mt-6 max-w-prose text-gray-600 sm:text-lg">
            Your private digital home for accurate cycle tracking, community support, and expert care— 
            designed by women, for women.
          </p>
        </div>

        {/* Core Features Cards */}
        <div className="mt-16 w-full">
          <h2 className="text-2xl font-semibold text-gray-800 mb-8">
            Discover Your Wellness Journey
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Cycle Tracker Card */}
            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-rose-400 to-pink-500" />
              <div className="p-6">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-rose-600" />
                </div>

                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Cycle Tracking
                </h3>

                <p className="text-gray-600 text-sm">
                  Science-backed menstrual cycle tracking, not guesswork. Understand your patterns.
                </p>
              </div>
            </div>

            {/* Community Card */}
            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-purple-400 to-purple-500" />
              <div className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>

                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Private Community
                </h3>

                <p className="text-gray-600 text-sm">
                  Safe space to share, connect, and support each other through posts and discussions.
                </p>
              </div>
            </div>

            {/* Doctor Chat Card */}
            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-blue-400 to-blue-500" />
              <div className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                </div>

                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Doctor Consultations
                </h3>

                <p className="text-gray-600 text-sm">
                  Private 1-on-1 chats with gynecologists for personal health questions and advice.
                </p>
              </div>
            </div>

            {/* AI Assistant Card */}
            <div className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-teal-400 to-teal-500" />
              <div className="p-6">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-teal-600" />
                </div>

                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  AI Wellness Guide
                </h3>

                <p className="text-gray-600 text-sm">
                  Your daily companion for emotional support, health education, and guidance.
                </p>
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
            <span className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-rose-100 to-purple-100 rounded-full text-rose-700 mb-4 inline-block">
              Wellness Features
            </span>
            <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">
              Why Choose{" "}
              <span className="bg-gradient-to-r from-rose-600 to-purple-600 bg-clip-text text-transparent">
                HOA
              </span>
              ?
            </h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              A comprehensive wellness ecosystem designed for women's health, privacy, and community support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-100/50 rounded-bl-full -z-0"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center text-white mb-6 shadow-md">
                  <Shield className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Private & Secure
                </h3>
                <p className="text-gray-600">
                  Your health data is completely private. End-to-end encryption and HIPAA-compliant security.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100/50 rounded-bl-full -z-0"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6 shadow-md">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Science-Backed Tracking
                </h3>
                <p className="text-gray-600">
                  Accurate cycle predictions based on medical research, not guesswork or generic algorithms.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-teal-100/50 rounded-bl-full -z-0"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center text-white mb-6 shadow-md">
                  <Clock className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Smart Day Planning
                </h3>
                <p className="text-gray-600">
                  Align your daily activities and self-care routines with your cycle phases and energy levels.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Banner */}
          <div className="mt-16 bg-gradient-to-r from-rose-600 to-purple-600 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-12 md:py-16 md:px-12 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              </div>

              <div className="relative">
                <h2 className="text-3xl font-bold mb-4">
                  Ready to start your wellness journey?
                </h2>
                <p className="text-rose-100 mb-8 max-w-xl mx-auto">
                  Join thousands of women discovering their bodies, building community, and taking control of their health with HOA.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button className="bg-white text-rose-700 hover:bg-rose-50 px-6 py-3">
                    Get Started on WhatsApp
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button asChild variant="outline" className="border-white text-white hover:bg-white hover:text-rose-700 px-6 py-3">
                    <Link href="/login">
                      Provider Portal
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </MaxWidthWrapper>
      </div>
    </div>
  );
}