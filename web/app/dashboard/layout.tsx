import { AppStateProvider } from "@/lib/app-state";
import { NavBar } from "@/components/NavBar";
import { ChatWidget } from "@/components/ChatWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <NavBar />
      {children}
      <ChatWidget />
    </AppStateProvider>
  );
}
