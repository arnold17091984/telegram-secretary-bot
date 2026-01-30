import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Triggers from "./pages/Triggers";
import Tasks from "./pages/Tasks";
import Meetings from "./pages/Meetings";
import Drafts from "./pages/Drafts";
import AuditLogs from "./pages/AuditLogs";
import SettingsPage from "./pages/Settings";
import Reminders from "./pages/Reminders";
import Calendar from "./pages/Calendar";
import RecurringTasks from "./pages/RecurringTasks";
import TaskCompletions from "./pages/TaskCompletions";
import Organizations from "./pages/Organizations";
import Billing from "./pages/Billing";

function Router() {
  return (
    <Switch>      <Route path={"/"} component={Home} />
      <Route path={"/triggers"} component={Triggers} />
      <Route path={"/tasks"} component={Tasks} />
      <Route path={"/meetings"} component={Meetings} />
      <Route path={"/drafts"} component={Drafts} />
      <Route path={"/audit-logs"} component={AuditLogs} />
      <Route path={"/settings"} component={SettingsPage} />
      <Route path={"/reminders"} component={Reminders} />
      <Route path={"/calendar"} component={Calendar} />
      <Route path={"/recurring-tasks"} component={RecurringTasks} />
      <Route path={"/task-completions"} component={TaskCompletions} />
      <Route path={"/organizations"} component={Organizations} />
      <Route path={"/billing"} component={Billing} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
