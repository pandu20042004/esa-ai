"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTransition } from "@/components/esai/shell/PageTransition";
import { useTheme } from "@/components/esai/shell/ThemeProvider";

export function SettingsRoute() {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <PageTransition>
      <section className="grid gap-7">
        <header className="grid gap-2">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">Settings</h1>
          <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--muted)]">Workspace preferences and account controls.</p>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <strong>{darkMode ? "Dark mode" : "Light mode"}</strong>
                <p className="m-0 text-sm text-[var(--muted)]">Warm palette follows this preference.</p>
              </div>
              <Button type="button" onClick={toggleTheme}>
                {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
                Toggle
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Account</CardTitle></CardHeader>
            <CardContent>
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="secondary">Sign out</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </PageTransition>
  );
}
