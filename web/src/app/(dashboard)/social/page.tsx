"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { 
  Users, 
  BarChart3, 
  MessageSquare, 
  Trophy, 
  Bell, 
  Search, 
  Plus, 
  MapPin, 
  MessageCircle 
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function SocialLearningPage() {
  const [activeTab, setActiveTab] = React.useState("groups")

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Top Brand Bar */}
      <div className="bg-green-700 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg">
            <Users className="h-5 w-5" />
          </div>
          <h1 className="font-bold text-lg">Social Learning Engine</h1>
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-green-600">
          <Bell className="h-5 w-5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-2">
        <div className="flex justify-between">
          <TabItem 
            active={activeTab === "groups"} 
            onClick={() => setActiveTab("groups")} 
            label="Study Groups" 
            icon={<Users className="h-4 w-4" />} 
          />
          <TabItem 
            active={activeTab === "rankings"} 
            onClick={() => setActiveTab("rankings")} 
            label="Rankings" 
            icon={<BarChart3 className="h-4 w-4" />} 
          />
          <TabItem 
            active={activeTab === "collaborate"} 
            onClick={() => setActiveTab("collaborate")} 
            label="Collaborate" 
            icon={<MessageSquare className="h-4 w-4" />} 
          />
          <TabItem 
            active={activeTab === "toppers"} 
            onClick={() => setActiveTab("toppers")} 
            label="Toppers" 
            icon={<Trophy className="h-4 w-4" />} 
          />
        </div>
      </div>

      <div className="p-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search study groups..." 
            className="pl-10 bg-slate-100 dark:bg-slate-800 border-none rounded-xl h-11"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <Button variant="outline" className="rounded-full bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800 font-medium h-9">
            <Users className="mr-2 h-3.5 w-3.5" />
            My Groups
          </Button>
          <Button variant="outline" className="rounded-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 h-9">
            Suggested
          </Button>
          <Button variant="outline" className="rounded-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 h-9 ml-auto">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create
          </Button>
        </div>

        {/* Your Study Groups Header */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Your Study Groups (2)</h2>
          <p className="text-xs text-slate-500">Groups you've joined for collaborative learning</p>
        </div>

        {/* Group Cards */}
        <div className="space-y-4">
          <GroupCard 
            title="UPSC 2025 Warriors"
            match="95%"
            meta="General Preparation • Delhi"
            desc="Focused group for UPSC 2025 attempt with daily discussions"
            members="87"
            activity="High"
            activityColor="green"
            tags={["History", "Polity"]}
            lastActive="2 mins ago"
          />
          <GroupCard 
            title="Psychology Optional Masters"
            match="88%"
            meta="Optional Subject • Mumbai"
            desc="Specialized group for Psychology optional preparation"
            members="34"
            activity="Medium"
            activityColor="orange"
            tags={["Psychology", "Mains"]}
            lastActive="1 hour ago"
          />
        </div>
      </div>
    </div>
  )
}

function TabItem({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 pb-3 px-2 cursor-pointer border-b-2 transition-colors",
        active 
          ? "border-green-600 text-green-700 dark:text-green-500" 
          : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  )
}

function GroupCard({ title, match, meta, desc, members, activity, activityColor, tags, lastActive }: any) {
  return (
    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{title}</h3>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
            {match} match
          </Badge>
        </div>
        
        <p className="text-xs text-slate-500 mb-2">{meta}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">{desc}</p>
        
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{members} members</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={cn("h-2 w-2 rounded-full", activityColor === 'green' ? "bg-green-500" : "bg-orange-500")} />
            <span>{activity} Activity</span>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {tags.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-normal">
              {tag}
            </Badge>
          ))}
        </div>

        <p className="text-[10px] text-slate-400 mb-4">Last active: {lastActive}</p>

        <div className="flex gap-2">
          <Button className="flex-1 bg-green-700 hover:bg-green-800 text-white rounded-xl">
            View Group
          </Button>
          <Button variant="secondary" size="icon" className="rounded-xl">
            <MessageCircle className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
