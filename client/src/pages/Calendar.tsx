import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ViewMode = "month" | "week" | "day";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  hangoutLink?: string;
  status?: string;
}

export default function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });
  

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [currentDate, viewMode]);

  // Fetch events
  const { data: eventsData, isLoading, refetch } = trpc.google.listEvents.useQuery({
    timeMin: dateRange.start.toISOString(),
    timeMax: dateRange.end.toISOString(),
    maxResults: 100,
  });

  const { data: googleCreds } = trpc.google.getCredentials.useQuery();

  // Update event mutation
  const updateEventMutation = trpc.google.updateEvent.useMutation({
    onSuccess: () => {
      toast.success("イベントを更新しました");
      setIsEditing(false);
      setSelectedEvent(null);
      refetch();
    },
    onError: (error) => {
      toast.error("更新に失敗しました: " + error.message);
    },
  });

  // Delete event mutation
  const deleteEventMutation = trpc.google.deleteEvent.useMutation({
    onSuccess: () => {
      toast.success("イベントを削除しました");
      setShowDeleteConfirm(false);
      setSelectedEvent(null);
      refetch();
    },
    onError: (error) => {
      toast.error("削除に失敗しました: " + error.message);
    },
  });

  // Navigation functions
  const goToToday = () => setCurrentDate(new Date());

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  // Format date for display
  const formatDateHeader = () => {
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" };
    if (viewMode === "day") {
      options.day = "numeric";
      options.weekday = "long";
    }
    return currentDate.toLocaleDateString("ja-JP", options);
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    if (!eventsData?.events) return [];
    return eventsData.events.filter((event) => {
      const eventDate = new Date(event.start.dateTime || event.start.date || "");
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  // Generate calendar days for month view
  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  // Generate week days
  const generateWeekDays = () => {
    const days: Date[] = [];
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);

    for (let i = 0; i < 7; i++) {
      days.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }

    return days;
  };

  // Format time
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Start editing
  const startEditing = () => {
    if (!selectedEvent) return;
    
    const startDateTime = selectedEvent.start.dateTime ? new Date(selectedEvent.start.dateTime) : null;
    const endDateTime = selectedEvent.end.dateTime ? new Date(selectedEvent.end.dateTime) : null;
    
    setEditForm({
      title: selectedEvent.summary || "",
      description: selectedEvent.description || "",
      startDate: startDateTime ? startDateTime.toISOString().split("T")[0] : "",
      startTime: startDateTime ? startDateTime.toTimeString().slice(0, 5) : "",
      endDate: endDateTime ? endDateTime.toISOString().split("T")[0] : "",
      endTime: endDateTime ? endDateTime.toTimeString().slice(0, 5) : "",
    });
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({
      title: "",
      description: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
    });
  };

  // Save event
  const saveEvent = () => {
    if (!selectedEvent) return;

    const startTime = editForm.startDate && editForm.startTime
      ? new Date(`${editForm.startDate}T${editForm.startTime}`).toISOString()
      : undefined;
    const endTime = editForm.endDate && editForm.endTime
      ? new Date(`${editForm.endDate}T${editForm.endTime}`).toISOString()
      : undefined;

    updateEventMutation.mutate({
      eventId: selectedEvent.id,
      title: editForm.title,
      description: editForm.description,
      startTime,
      endTime,
    });
  };

  // Delete event
  const deleteEvent = () => {
    if (!selectedEvent) return;
    deleteEventMutation.mutate({ eventId: selectedEvent.id });
  };

  if (!googleCreds?.isConnected) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Googleカレンダーが接続されていません</h3>
              <p className="text-muted-foreground text-center mb-4">
                カレンダーを表示するには、設定画面からGoogleアカウントを連携してください。
              </p>
              <Button onClick={() => window.location.href = "/settings"}>
                設定画面へ
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-6 w-6" />
              カレンダー
            </h1>
            <p className="text-muted-foreground">Googleカレンダーの予定を表示</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              更新
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              {/* View mode selector */}
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                >
                  月
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                >
                  週
                </Button>
                <Button
                  variant={viewMode === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("day")}
                >
                  日
                </Button>
              </div>

              {/* Date navigation */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  今日
                </Button>
                <Button variant="outline" size="sm" onClick={goToNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Current date display */}
              <div className="text-lg font-semibold">{formatDateHeader()}</div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar View */}
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : viewMode === "month" ? (
              /* Month View */
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["日", "月", "火", "水", "木", "金", "土"].map((day, i) => (
                    <div
                      key={day}
                      className={`text-center text-sm font-medium py-2 ${
                        i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {generateMonthDays().map((date, index) => (
                    <div
                      key={index}
                      className={`min-h-[100px] border rounded-lg p-1 ${
                        date ? "bg-card hover:bg-accent/50 cursor-pointer" : "bg-muted/30"
                      } ${date && isToday(date) ? "ring-2 ring-primary" : ""}`}
                      onClick={() => date && setCurrentDate(date)}
                    >
                      {date && (
                        <>
                          <div
                            className={`text-sm font-medium ${
                              date.getDay() === 0
                                ? "text-red-500"
                                : date.getDay() === 6
                                ? "text-blue-500"
                                : ""
                            }`}
                          >
                            {date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {getEventsForDate(date)
                              .slice(0, 3)
                              .map((event) => (
                                <div
                                  key={event.id}
                                  className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEvent(event);
                                  }}
                                >
                                  {formatTime(event.start.dateTime)} {event.summary}
                                </div>
                              ))}
                            {getEventsForDate(date).length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{getEventsForDate(date).length - 3} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : viewMode === "week" ? (
              /* Week View */
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {generateWeekDays().map((date, i) => (
                    <div
                      key={i}
                      className={`text-center p-2 rounded-lg ${
                        isToday(date) ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <div className="text-xs">
                        {["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}
                      </div>
                      <div className="text-lg font-bold">{date.getDate()}</div>
                    </div>
                  ))}
                </div>

                {/* Events grid */}
                <div className="grid grid-cols-7 gap-2">
                  {generateWeekDays().map((date, i) => (
                    <div key={i} className="min-h-[200px] space-y-1">
                      {getEventsForDate(date).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs bg-primary/10 text-primary rounded p-2 cursor-pointer hover:bg-primary/20"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <div className="font-medium">{formatTime(event.start.dateTime)}</div>
                          <div className="truncate">{event.summary}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Day View */
              <div className="space-y-2">
                {eventsData?.events && eventsData.events.length > 0 ? (
                  eventsData.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="text-sm font-medium text-muted-foreground w-20">
                        {formatTime(event.start.dateTime) || "終日"}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{event.summary}</div>
                        {event.location && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        )}
                        {event.hangoutLink && (
                          <Badge variant="secondary" className="mt-1">
                            <Video className="h-3 w-3 mr-1" />
                            Google Meet
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    この日の予定はありません
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Detail Dialog */}
        <Dialog open={!!selectedEvent && !isEditing} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedEvent?.summary}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {selectedEvent?.start.dateTime
                    ? new Date(selectedEvent.start.dateTime).toLocaleString("ja-JP")
                    : selectedEvent?.start.date}
                  {" - "}
                  {selectedEvent?.end.dateTime
                    ? new Date(selectedEvent.end.dateTime).toLocaleString("ja-JP")
                    : selectedEvent?.end.date}
                </span>
              </div>

              {selectedEvent?.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent?.hangoutLink && (
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={selectedEvent.hangoutLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    Google Meetに参加
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {selectedEvent?.description && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedEvent.description}
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-1" />
                    編集
                  </Button>
                  <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    削除
                  </Button>
                </div>
                {selectedEvent?.htmlLink && (
                  <Button variant="outline" asChild>
                    <a href={selectedEvent.htmlLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Googleカレンダーで開く
                    </a>
                  </Button>
                )}
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Event Dialog */}
        <Dialog open={isEditing} onOpenChange={() => cancelEditing()}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>イベントを編集</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">タイトル</Label>
                <Input
                  id="title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="イベントのタイトル"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">開始日</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">開始時刻</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endDate">終了日</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">終了時刻</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="イベントの説明（任意）"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-1" />
                キャンセル
              </Button>
              <Button onClick={saveEvent} disabled={updateEventMutation.isPending}>
                {updateEventMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>イベントを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                「{selectedEvent?.summary}」を削除します。この操作はGoogleカレンダーにも反映され、元に戻すことはできません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteEvent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteEventMutation.isPending}
              >
                {deleteEventMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                削除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
