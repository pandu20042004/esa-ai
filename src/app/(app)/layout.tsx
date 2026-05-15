import { AppShell } from "@/components/esai/shell/AppShell";
import { CompetitionProvider } from "@/components/esai/shell/CompetitionProvider";
import { ThemeProvider } from "@/components/esai/shell/ThemeProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CompetitionProvider>
        <AppShell>{children}</AppShell>
      </CompetitionProvider>
    </ThemeProvider>
  );
}
