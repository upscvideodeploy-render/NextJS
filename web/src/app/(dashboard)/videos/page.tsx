"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { 
  Clapperboard, 
  Library, 
  FileText, 
  List, 
  CalendarDays, 
  FileQuestion,
  Play
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function VideoGeneratorPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 p-4">
      {/* Header Card */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-[#1a1f36] p-6 text-white shadow-xl mb-6 relative overflow-hidden"
      >
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-1">Cinematic Video Generator</h1>
          <p className="text-slate-400 text-sm mb-6">AI-Powered UPSC Learning Videos</p>

          <h3 className="text-sm font-semibold text-slate-300 mb-3">AI Tools Status</h3>
          <div className="flex flex-wrap gap-2 mb-8">
            <StatusChip label="NotebookLM" />
            <StatusChip label="Sora AI" />
            <StatusChip label="Runway ML" />
            <StatusChip label="Pictory" />
            <StatusChip label="ElevenLabs" />
          </div>

          <div className="flex gap-3 relative -bottom-4">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-500/20 px-8">
              <Clapperboard className="mr-2 h-5 w-5" />
              Generate
            </Button>
            <Button size="lg" variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border border-white/10 rounded-xl backdrop-blur-md">
              <Library className="mr-2 h-5 w-5" />
              Library (3)
            </Button>
          </div>
        </div>
        
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </motion.div>

      {/* Select Content Source */}
      <div className="mb-6 mt-8">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 px-2">Select Content Source</h3>
        <div className="grid grid-cols-2 gap-4">
          <SourceTile 
            icon={<FileText className="h-6 w-6 text-slate-600 dark:text-slate-300" />}
            title="Study Notes"
            count="24 items available"
          />
          <SourceTile 
            icon={<List className="h-6 w-6 text-slate-600 dark:text-slate-300" />}
            title="Syllabus Topics"
            count="156 items available"
          />
          <SourceTile 
            icon={<CalendarDays className="h-6 w-6 text-slate-600 dark:text-slate-300" />}
            title="Current Affairs"
            count="48 items available"
          />
          <SourceTile 
            icon={<FileQuestion className="h-6 w-6 text-slate-600 dark:text-slate-300" />}
            title="Previous Papers"
            count="30 items available"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 px-2">Quick Actions</h3>
        {/* Placeholder for Quick Actions */}
        <div className="flex gap-4 overflow-x-auto pb-4 px-2">
            <div className="min-w-[150px] h-24 rounded-xl bg-slate-100 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-sm">
                Recent Drafts
            </div>
            <div className="min-w-[150px] h-24 rounded-xl bg-slate-100 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-sm">
                Tutorials
            </div>
        </div>
      </div>
    </div>
  )
}

function StatusChip({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-xs text-slate-300">
      <span>{label}</span>
      <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
    </div>
  )
}

function SourceTile({ icon, title, count }: { icon: React.ReactNode, title: string, count: string }) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-start gap-3 cursor-pointer"
    >
      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{count}</p>
      </div>
    </motion.div>
  )
}
