import TitleBar from "@/components/TitleBar";
import Sidebar from "@/components/Sidebar";
import SetupScreen from "@/screens/SetupScreen";
import InterviewScreen from "@/screens/InterviewScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import { useStore } from "@/lib/store";

export default function App() {
  const { screen, compact } = useStore();

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {/* Compact (floating) mode hides the sidebar for a minimal overlay */}
        {!compact && <Sidebar />}
        <main className="min-w-0 flex-1">
          {screen === "setup" && <SetupScreen />}
          {screen === "interview" && <InterviewScreen />}
          {screen === "history" && <HistoryScreen />}
          {screen === "settings" && <SettingsScreen />}
        </main>
      </div>
    </div>
  );
}
