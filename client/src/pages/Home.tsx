import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  CheckSquare,
  Calendar,
  FileText,
  ArrowUpRight,
  Clock,
  Zap,
  Activity,
  MessageSquare,
  Users,
  TrendingUp,
  Sparkles
} from "lucide-react";

export default function Home() {
  const stats = [
    {
      title: "Active Tasks",
      value: "12",
      change: "+2 from yesterday",
      icon: CheckSquare,
      accent: "from-teal-500 to-cyan-500",
      description: "3 due today"
    },
    {
      title: "Upcoming Meetings",
      value: "5",
      change: "2 today, 3 this week",
      icon: Calendar,
      accent: "from-cyan-500 to-blue-500",
      description: "Starting in 2h"
    },
    {
      title: "Pending Drafts",
      value: "3",
      change: "+1 added today",
      icon: FileText,
      accent: "from-blue-500 to-indigo-500",
      description: "Awaiting approval"
    },
    {
      title: "Bot Status",
      value: "Online",
      change: "Last sync: 2m ago",
      icon: Bot,
      accent: "from-emerald-500 to-teal-500",
      description: "All systems normal",
      isStatus: true
    },
  ];

  const recentTasks = [
    { title: "Update API Documentation", deadline: "Today 17:00", status: "in_progress", priority: "high" },
    { title: "Review Pull Request #123", deadline: "Tomorrow 10:00", status: "pending", priority: "medium" },
    { title: "Deploy v2.1 to staging", deadline: "Tomorrow 15:00", status: "pending", priority: "high" },
  ];

  const upcomingMeetings = [
    { title: "Team Standup", time: "Today 14:00 - 14:30", participants: 5 },
    { title: "Project Review", time: "Tomorrow 15:00 - 16:00", participants: 8 },
    { title: "1:1 with Manager", time: "Wed 10:00 - 10:30", participants: 2 },
  ];

  const aiActivity = [
    { action: "Draft generated", target: "Meeting summary for Team Standup", time: "5 min ago" },
    { action: "Task created", target: "Follow up on Q4 planning", time: "1 hour ago" },
    { action: "Reminder sent", target: "API Documentation deadline", time: "2 hours ago" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="space-y-2 fade-in-up">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Command Center
              </h1>
              <p className="text-sm text-muted-foreground">
                Your AI-powered workspace overview
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card
              key={stat.title}
              className="neural-card rounded-xl overflow-hidden transition-all duration-300 hover:translate-y-[-2px] fade-in-up"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {stat.title}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold tracking-tight ${stat.isStatus ? 'text-emerald-400' : 'text-foreground'}`}>
                        {stat.value}
                      </span>
                      {stat.isStatus && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.accent} p-[1px]`}>
                    <div className="h-full w-full rounded-[7px] bg-card flex items-center justify-center">
                      <stat.icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-primary/10">
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-medium">{stat.change}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Tasks */}
          <Card className="neural-card rounded-xl lg:col-span-2 fade-in-up delay-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">Recent Tasks</CardTitle>
                </div>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group">
                  View all
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentTasks.map((task, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 group border border-transparent hover:border-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      task.priority === 'high' ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {task.deadline}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    task.status === 'in_progress'
                      ? 'status-active'
                      : 'status-pending'
                  }`}>
                    {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Activity Feed */}
          <Card className="neural-card rounded-xl fade-in-up delay-400">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">AI Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors"
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="h-3 w-3 text-primary" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {activity.action}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.target}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 font-mono">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Upcoming Meetings */}
          <Card className="neural-card rounded-xl fade-in-up delay-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">Upcoming Meetings</CardTitle>
                </div>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group">
                  Calendar
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingMeetings.map((meeting, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 group border border-transparent hover:border-primary/10"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {meeting.title}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {meeting.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {meeting.participants}
                      </span>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="neural-card rounded-xl fade-in-up delay-500">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: CheckSquare, label: "New Task", color: "from-teal-500/20 to-cyan-500/20" },
                  { icon: Calendar, label: "Schedule Meeting", color: "from-cyan-500/20 to-blue-500/20" },
                  { icon: FileText, label: "Generate Draft", color: "from-blue-500/20 to-indigo-500/20" },
                  { icon: MessageSquare, label: "Send Message", color: "from-indigo-500/20 to-violet-500/20" },
                ].map((action, index) => (
                  <button
                    key={index}
                    className={`p-4 rounded-xl bg-gradient-to-br ${action.color} border border-primary/10 hover:border-primary/30 transition-all duration-200 hover:shadow-glow-sm group`}
                  >
                    <div className="flex flex-col items-center gap-2 text-center">
                      <action.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium text-foreground">{action.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Stats Bar */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-primary/10 fade-in-up delay-500">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-glow" />
              <span className="text-xs text-muted-foreground">System Status: <span className="text-emerald-400 font-medium">Operational</span></span>
            </div>
            <div className="h-4 w-px bg-primary/20" />
            <span className="text-xs text-muted-foreground font-mono">Last update: <span className="text-foreground">2 minutes ago</span></span>
          </div>
          <span className="text-[10px] text-muted-foreground/50 font-mono">neural-secretary v1.0.0</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
