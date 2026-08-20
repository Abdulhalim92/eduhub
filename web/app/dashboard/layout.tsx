import { AppStateProvider } from "@/lib/app-state";
import { NavBar } from "@/components/NavBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <NavBar />
      {children}
    </AppStateProvider>
  );
}
