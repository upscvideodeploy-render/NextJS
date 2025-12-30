"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { 
  CloudUpload, 
  Sparkles, 
  HelpCircle, 
  Newspaper, 
  ClipboardList, 
  BookOpen, 
  Star, 
  User, 
  Gift, 
  TrendingUp, 
  RefreshCw, 
  ChevronRight, 
  Lightbulb
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Hero Panel */}
      <div className="p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-6 text-white shadow-xl"
        >
          {/* Background Decorative Elements */}
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-slate-900/50 to-transparent" />

          <div className="relative z-10 mb-16">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none">UPSC CSE Master</h1>
                <p className="text-xs text-blue-200">Civil Services Excellence</p>
              </div>
            </div>

            <p className="text-lg font-medium mt-6">Welcome Aspirant!</p>
            <h2 className="text-2xl font-bold leading-tight mt-1 max-w-[80%]">
              Your Complete Journey from Preparation to Selection
            </h2>
          </div>

          {/* Promo Card Overlay */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute -bottom-1 -right-1 left-4 bg-gradient-to-r from-orange-400 to-orange-500 rounded-tl-2xl rounded-br-2xl rounded-tr-xl rounded-bl-xl p-4 shadow-lg flex items-center justify-between"
          >
            <div>
              <h3 className="text-lg font-bold text-white leading-none">1 Day FREE</h3>
              <div className="text-lg font-bold text-white leading-none">Premium Access</div>
              <p className="text-xs text-orange-100 mt-1">Experience all features</p>
            </div>
            <Button size="sm" className="bg-orange-300/20 hover:bg-orange-300/30 text-white border-none shadow-none">
              <Gift className="mr-2 h-4 w-4" />
              Start Free Trial
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Discover Features Header */}
      <div className="px-6 py-2">
        <h3 className="text-center text-lg font-semibold text-slate-800 dark:text-slate-200">Discover Our Features</h3>
      </div>

      {/* Feature Carousel (Current Affairs) */}
      <div className="px-4 mb-6">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="rounded-3xl bg-emerald-500 p-8 text-center text-white shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-white/20 p-3 rounded-full mb-3 backdrop-blur-sm">
              <Newspaper className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold">Current Affairs</h3>
            <p className="text-emerald-100 text-sm mt-1">Daily updates with UPSC-focused analysis</p>
          </div>
        </motion.div>
        <div className="flex justify-center gap-2 mt-3">
          <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="h-2 w-2 rounded-full bg-blue-600" />
          <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
      </div>

      {/* Your Progress Header */}
      <div className="px-6 py-2">
        <h3 className="text-center text-lg font-semibold text-slate-800 dark:text-slate-200">Your Progress</h3>
      </div>

      {/* Feature Grid */}
      <div className="px-4 grid grid-cols-2 gap-4 mb-8">
        <FeatureCard 
          icon={<CloudUpload className="text-blue-500" />} 
          title="Upload Content" 
          sub="PDFs, Images & More"
          color="bg-blue-50 dark:bg-blue-900/20"
          href="/notes"
        />
        <FeatureCard 
          icon={<Sparkles className="text-purple-500" />} 
          title="Generate Notes" 
          sub="AI-Powered Summaries"
          color="bg-purple-50 dark:bg-purple-900/20"
          href="/notes/generate"
        />
        <FeatureCard 
          icon={<HelpCircle className="text-teal-500" />} 
          title="Practice MCQs" 
          sub="Smart Questions"
          color="bg-teal-50 dark:bg-teal-900/20"
          href="/practice"
        />
        <FeatureCard 
          icon={<Newspaper className="text-green-500" />} 
          title="Current Affairs" 
          sub="Daily Updates"
          color="bg-green-50 dark:bg-green-900/20"
          href="/daily-ca"
        />
        <FeatureCard 
          icon={<ClipboardList className="text-red-500" />} 
          title="Mock Tests" 
          sub="Full-Length Tests"
          color="bg-red-50 dark:bg-red-900/20"
          href="/practice/mock-test"
        />
        <FeatureCard 
          icon={<BookOpen className="text-orange-500" />} 
          title="UPSC Syllabus" 
          sub="Complete Coverage"
          color="bg-orange-50 dark:bg-orange-900/20"
          href="/syllabus"
        />
        <FeatureCard 
          icon={<Star className="text-pink-500" />} 
          title="Subscription" 
          sub="Premium Features"
          color="bg-pink-50 dark:bg-pink-900/20"
          href="/pricing"
        />
        <FeatureCard 
          icon={<User className="text-slate-500" />} 
          title="Profile" 
          sub="Account Settings"
          color="bg-slate-100 dark:bg-slate-800/50"
          href="/settings"
        />
      </div>

      {/* Today's Motivation */}
      <div className="px-4 mb-6">
        <h3 className="text-center text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Today's Motivation</h3>
        
        <Card className="bg-blue-800 border-none text-white mb-4 shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="h-24 w-24" />
          </div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5" />
              <span className="font-bold text-xl">0% Complete</span>
            </div>
            <Progress value={5} className="h-1.5 bg-blue-900/50 mb-3" />
            <p className="text-sm text-blue-100">✨ Your UPSC journey starts here!</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-bold text-2xl">”</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Quote of the Day</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-slate-600 dark:text-slate-400 italic mb-4">
              "Dream big, work hard, stay focused, and surround yourself with good people."
            </p>
            <div className="flex justify-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="px-4 mb-8">
        <h3 className="text-center text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Recent Activity</h3>
        
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <ActivityItem 
              icon={<Star className="h-5 w-5 text-blue-600" />}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              title="Welcome to UPSC CSE Master"
              subtitle="Start your preparation journey today"
              time="Just now"
            />
            <ActivityItem 
              icon={<Lightbulb className="h-5 w-5 text-amber-500" />}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              title="Explore App Features"
              subtitle="Upload content and generate AI notes"
              time="1 minute ago"
            />
          </div>
          <div className="p-4 text-center">
            <Link href="/activity" className="text-blue-600 text-sm font-medium hover:underline">
              View All Activities
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, sub, color, href }: { icon: React.ReactNode, title: string, sub: string, color: string, href: string }) {
  return (
    <Link href={href}>
      <motion.div 
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center h-full"
      >
        <div className={cn("p-3 rounded-xl mb-3", color)}>
          {icon}
        </div>
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{sub}</p>
      </motion.div>
    </Link>
  )
}

function ActivityItem({ icon, iconBg, title, subtitle, time }: { icon: React.ReactNode, iconBg: string, title: string, subtitle: string, time: string }) {
  return (
    <div className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
      <div className={cn("p-2 rounded-xl", iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] text-slate-400">{time}</span>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </div>
  )
}
