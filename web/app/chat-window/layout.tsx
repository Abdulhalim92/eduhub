import { C } from "@/lib/data";

export default function ChatWindowLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>{children}</div>;
}
