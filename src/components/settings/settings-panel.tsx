"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { User, Moon, Sparkles, TrendingUp, Mail, Loader2, Users, Eye, EyeOff, Copy, LayoutGrid, Archive } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { DEMO_MODE } from "@/lib/demo-mode";
import { useLibraryShell } from "@/components/library/library-shell-context";
import { ManageProfilesPanel } from "./manage-profiles-panel";
import { PROFILE_COLORS, type PublicProfile } from "@/lib/profiles/types";
import type { PublicAppSettings, SmtpEncryption } from "@/lib/settings/types";
import { METADATA_PROVIDER_INFO, type MetadataProviderId } from "@/lib/metadata/types";

interface SettingsPanelProps {
  settings: PublicAppSettings;
  profile: PublicProfile;
}

type Category = "profile" | "theme" | "profiles" | "library" | "metadata" | "trending" | "email" | "backup";

const CATEGORIES: {
  id: Category;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "profiles", label: "Manage Profiles", icon: Users, adminOnly: true },
  { id: "theme", label: "Theme", icon: Moon },
  { id: "library", label: "Library", icon: LayoutGrid, adminOnly: true },
  { id: "metadata", label: "Metadata", icon: Sparkles, adminOnly: true },
  { id: "trending", label: "Trending", icon: TrendingUp, adminOnly: true },
  { id: "email", label: "E-Reader Email", icon: Mail, adminOnly: true },
  { id: "backup", label: "Backup", icon: Archive, adminOnly: true },
];

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="sm:shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <h2 className="font-heading text-base font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="px-5">{children}</div>
      {footer && <div className="flex justify-end border-t border-border p-4">{footer}</div>}
    </div>
  );
}

export function SettingsPanel({ settings, profile }: SettingsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { profiles, activeProfileId, books } = useLibraryShell();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  // Needs an absolute URL since it's copied into an app on a different
  // device — only resolvable client-side, hence the mounted guard.
  const opdsUrl = mounted ? `${window.location.origin}/opds` : "";
  const isAdmin = profile.role === "admin";
  const visibleCategories = CATEGORIES.filter((c) => !c.adminOnly || isAdmin);
  const tabParam = searchParams.get("tab");
  const [categoryState, setCategory] = React.useState<Category>(
    () => CATEGORIES.find((c) => c.id === tabParam)?.id ?? "profile"
  );
  const category = visibleCategories.some((c) => c.id === categoryState)
    ? categoryState
    : "profile";

  React.useEffect(() => {
    const match = CATEGORIES.find((c) => c.id === tabParam)?.id;
    if (match) setCategory(match);
  }, [tabParam]);

  const selectCategory = (id: Category) => {
    setCategory(id);
    router.replace(`/settings?tab=${id}`, { scroll: false });
  };

  // Collapses a burst of autosaves (e.g. tabbing through several fields) into
  // a single "Saved" toast instead of one per field.
  const savedToastTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifySaved = () => {
    if (savedToastTimeout.current) clearTimeout(savedToastTimeout.current);
    savedToastTimeout.current = setTimeout(() => {
      toast.add({ title: "Saved", type: "success" });
    }, 600);
  };
  React.useEffect(() => {
    return () => {
      if (savedToastTimeout.current) clearTimeout(savedToastTimeout.current);
    };
  }, []);

  // profile fields
  const [name, setName] = React.useState(profile.name);
  const [color, setColor] = React.useState(profile.color);
  const [ereaderEmail, setEreaderEmail] = React.useState(profile.ereaderEmail ?? "");

  // profile password
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [removingPassword, setRemovingPassword] = React.useState(false);

  // library
  const [booksPerPage, setBooksPerPage] = React.useState(settings.booksPerPage);
  const [searchResultLimit, setSearchResultLimit] = React.useState(settings.searchResultLimit);
  const [uploadMaxSizeMb, setUploadMaxSizeMb] = React.useState(settings.uploadMaxSizeMb);

  // metadata
  const [candidateLimit, setCandidateLimit] = React.useState(settings.metadataCandidateLimit);
  const [metadataProviders, setMetadataProviders] = React.useState(settings.metadataProviders);

  // trending
  const [trendingEnabled, setTrendingEnabled] = React.useState(settings.trendingEnabled);

  // smtp
  const [smtpHost, setSmtpHost] = React.useState(settings.smtp.host ?? "");
  const [smtpPort, setSmtpPort] = React.useState(settings.smtp.port ?? 587);
  const [smtpEncryption, setSmtpEncryption] = React.useState<SmtpEncryption>(
    settings.smtp.encryption ?? "none"
  );
  const [smtpUser, setSmtpUser] = React.useState(settings.smtp.user ?? "");
  const [smtpPass, setSmtpPass] = React.useState("");
  const [showSmtpPass, setShowSmtpPass] = React.useState(false);
  const [smtpFrom, setSmtpFrom] = React.useState(settings.smtp.fromAddress ?? "");

  // backup
  const [includeFiles, setIncludeFiles] = React.useState(false);
  const totalBookBytes = books.reduce((sum, b) => sum + b.size, 0);

  React.useEffect(() => {
    setName(profile.name);
    setColor(profile.color);
    setEreaderEmail(profile.ereaderEmail ?? "");
  }, [profile]);

  const saveProfile = async (overrides?: Partial<{ name: string; color: string; ereaderEmail: string }>) => {
    const payload = {
      name: overrides?.name ?? name,
      color: overrides?.color ?? color,
      ereaderEmail: (overrides?.ereaderEmail ?? ereaderEmail) || null,
    };
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      notifySaved();
      router.refresh();
    } catch {
      toast.add({ title: "Couldn't save profile", type: "error" });
    }
  };

  const savePassword = async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast.add({ title: "Passwords don't match", type: "error" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update password");
      toast.add({ title: "Password updated", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch (e) {
      toast.add({ title: "Couldn't update password", description: (e as Error).message, type: "error" });
    } finally {
      setSavingPassword(false);
    }
  };

  const removePassword = async () => {
    setRemovingPassword(true);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          removePassword: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to remove password");
      toast.add({ title: "Password removed", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch (e) {
      toast.add({ title: "Couldn't remove password", description: (e as Error).message, type: "error" });
    } finally {
      setRemovingPassword(false);
    }
  };

  const saveBooksPerPage = async (value?: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booksPerPage: value ?? booksPerPage }),
      });
      if (!res.ok) throw new Error();
      notifySaved();
      router.refresh();
    } catch {
      toast.add({ title: "Couldn't save settings", type: "error" });
    }
  };

  const saveSearchResultLimit = async (value?: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchResultLimit: value ?? searchResultLimit }),
      });
      if (!res.ok) throw new Error();
      notifySaved();
      router.refresh();
    } catch {
      toast.add({ title: "Couldn't save settings", type: "error" });
    }
  };

  const saveUploadMaxSizeMb = async (value?: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadMaxSizeMb: value ?? uploadMaxSizeMb }),
      });
      if (!res.ok) throw new Error();
      notifySaved();
      router.refresh();
    } catch {
      toast.add({ title: "Couldn't save settings", type: "error" });
    }
  };

  const saveMetadata = async (value?: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadataCandidateLimit: value ?? candidateLimit }),
      });
      if (!res.ok) throw new Error();
      notifySaved();
    } catch {
      toast.add({ title: "Couldn't save settings", type: "error" });
    }
  };

  const toggleMetadataProvider = async (id: MetadataProviderId, enabled: boolean) => {
    const next = enabled
      ? [...metadataProviders, id]
      : metadataProviders.filter((p) => p !== id);
    setMetadataProviders(next);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadataProviders: next }),
      });
      if (!res.ok) throw new Error();
      notifySaved();
    } catch {
      setMetadataProviders(metadataProviders);
      toast.add({ title: "Couldn't save settings", type: "error" });
    }
  };

  const saveTrending = async (enabled: boolean) => {
    setTrendingEnabled(enabled);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trendingEnabled: enabled }),
    });
    if (res.ok) {
      notifySaved();
      router.refresh();
    } else {
      toast.add({ title: "Couldn't save settings", type: "error" });
    }
  };

  const saveSmtp = async (overrides?: Partial<{ encryption: SmtpEncryption }>) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp: {
            host: smtpHost || undefined,
            port: smtpPort,
            encryption: overrides?.encryption ?? smtpEncryption,
            user: smtpUser || undefined,
            fromAddress: smtpFrom || undefined,
            ...(smtpPass ? { pass: smtpPass } : {}),
          },
        }),
      });
      if (!res.ok) throw new Error();
      setSmtpPass("");
      notifySaved();
    } catch {
      toast.add({ title: "Couldn't save settings", type: "error" });
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 md:flex-row md:gap-8">
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:w-48 md:shrink-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {visibleCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectCategory(c.id)}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors",
              category === c.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <c.icon className="size-4 shrink-0" strokeWidth={2} />
            {c.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 pb-16">
        {category === "profile" && (
          <div className="flex flex-col gap-6">
            <SectionCard
              title="Profile"
              description="Your name, avatar color, and where “Send to e-reader” delivers books."
            >
              <SettingRow title="Avatar">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className={cn(color, "font-semibold text-white")}>
                      {name.trim().charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1">
                    {PROFILE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        onClick={() => {
                          setColor(c);
                          saveProfile({ color: c });
                        }}
                        className={cn(
                          "size-5 rounded-full transition-transform hover:scale-110",
                          c,
                          color === c &&
                            "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </SettingRow>
              <SettingRow title="Display name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    const trimmed = name.trim();
                    if (trimmed && trimmed !== profile.name) saveProfile({ name: trimmed });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="w-full sm:w-56"
                />
              </SettingRow>
              <SettingRow
                title="E-reader email"
                description="Books sent via “Send to e-reader” go here (e.g. your Kindle address)."
              >
                <Input
                  type="email"
                  value={ereaderEmail}
                  onChange={(e) => setEreaderEmail(e.target.value)}
                  onBlur={() => {
                    if (ereaderEmail !== (profile.ereaderEmail ?? "")) saveProfile();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  placeholder="you@kindle.com"
                  className="w-full sm:w-56"
                />
              </SettingRow>
            </SectionCard>

            <SectionCard
              title="Password"
              description={
                profile.hasPassword
                  ? "This profile is locked — switching to it asks for the password below."
                  : "Optionally lock this profile so switching to it asks for a password. Fill in and confirm a new password below to save it."
              }
              footer={
                profile.hasPassword ? (
                  <Button
                    variant="outline"
                    onClick={removePassword}
                    disabled={removingPassword || savingPassword}
                    className="gap-2"
                  >
                    {removingPassword && <Loader2 className="size-4 animate-spin" />}
                    Remove password
                  </Button>
                ) : undefined
              }
            >
              {profile.hasPassword && (
                <SettingRow title="Current password">
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full sm:w-56"
                  />
                </SettingRow>
              )}
              <SettingRow title={profile.hasPassword ? "New password" : "Password"}>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 4 characters"
                  className="w-full sm:w-56"
                />
              </SettingRow>
              <SettingRow title="Confirm password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={savePassword}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="w-full sm:w-56"
                />
              </SettingRow>
              {savingPassword && (
                <p className="pb-4 text-xs text-muted-foreground">Saving password…</p>
              )}
            </SectionCard>
          </div>
        )}

        {category === "theme" && (
          <SectionCard title="Theme" description="Choose how Bookhoarder looks on this device.">
            <SettingRow
              title="Appearance"
              description="System matches your OS/browser setting automatically."
            >
              <div className="flex items-center gap-1 rounded-full border border-border p-1">
                {(
                  [
                    { id: "light", label: "Light" },
                    { id: "dark", label: "Dark" },
                    { id: "system", label: "System" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      mounted && theme === opt.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </SectionCard>
        )}

        {category === "profiles" && isAdmin && (
          <ManageProfilesPanel
            profiles={profiles}
            activeProfileId={activeProfileId}
            onChanged={() => router.refresh()}
          />
        )}

        {category === "library" && (
          <SectionCard
            title="Library"
            description="Controls pagination and uploads across your book grids."
          >
            <SettingRow
              title="Max upload size"
              description="Largest .epub file accepted by uploads, in MB (1–500)."
            >
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={uploadMaxSizeMb}
                  onChange={(e) =>
                    setUploadMaxSizeMb(Math.min(500, Math.max(1, Number(e.target.value) || 1)))
                  }
                  onBlur={() => saveUploadMaxSizeMb()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">MB</span>
              </div>
            </SettingRow>
            <SettingRow
              title="Books per page"
              description="How many books to show per page before Previous/Next appears (10–500)."
            >
              <Input
                type="number"
                min={10}
                max={500}
                value={booksPerPage}
                onChange={(e) =>
                  setBooksPerPage(Math.min(500, Math.max(10, Number(e.target.value) || 10)))
                }
                onBlur={() => saveBooksPerPage()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-20"
              />
            </SettingRow>
            <SettingRow
              title="Search results"
              description="How many matches the ⌘K search dialog shows before nudging you to narrow the query (1–100)."
            >
              <Input
                type="number"
                min={1}
                max={100}
                value={searchResultLimit}
                onChange={(e) =>
                  setSearchResultLimit(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                }
                onBlur={() => saveSearchResultLimit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-20"
              />
            </SettingRow>
          </SectionCard>
        )}

        {category === "metadata" && (
          <SectionCard
            title="Metadata"
            description="Controls how the “Fetch metadata” drawer looks up book details."
          >
            <SettingRow
              title="Candidates to fetch"
              description="How many results to show per lookup, per provider (1–20)."
            >
              <Input
                type="number"
                min={1}
                max={20}
                value={candidateLimit}
                onChange={(e) =>
                  setCandidateLimit(Math.min(20, Math.max(1, Number(e.target.value) || 1)))
                }
                onBlur={() => saveMetadata()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-20"
              />
            </SettingRow>
            <SettingRow
              title="Providers"
              description="Which sources to search. Results from every enabled provider are pooled together."
            >
              <div className="flex flex-col gap-3">
                {METADATA_PROVIDER_INFO.map(({ id, label }) => (
                  <div key={id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={metadataProviders.includes(id)}
                      onCheckedChange={(enabled) => toggleMetadataProvider(id, enabled)}
                    />
                  </div>
                ))}
              </div>
            </SettingRow>
          </SectionCard>
        )}

        {category === "trending" && (
          <SectionCard
            title="Trending"
            description="Adds a “Trending” page to the sidebar, sourced from Open Library."
          >
            <SettingRow
              title="Show Trending in sidebar"
              description="Toggle it off if you'd rather keep the sidebar focused on your own books."
            >
              <Switch checked={trendingEnabled} onCheckedChange={saveTrending} />
            </SettingRow>
          </SectionCard>
        )}

        {category === "email" && (
          <div className="flex flex-col gap-6">
          <SectionCard
            title="OPDS Catalog"
            description="Add this URL to an OPDS-compatible e-reader app (KOReader, Moon+ Reader, etc.) to browse and download books directly, no email needed."
          >
            <SettingRow title="Catalog URL">
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Input readOnly value={opdsUrl} className="w-full sm:w-72" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy catalog URL"
                  onClick={() => {
                    navigator.clipboard.writeText(opdsUrl);
                    toast.add({ title: "Copied", type: "success" });
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </SettingRow>
          </SectionCard>
          <SectionCard
            title="E-Reader Email (SMTP)"
            description="Server-wide outgoing mail settings, used to deliver books to any profile's e-reader email."
          >
            <SettingRow title="SMTP host">
              <Input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                onBlur={() => saveSmtp()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder="smtp.gmail.com"
                className="w-full sm:w-56"
              />
            </SettingRow>
            <SettingRow title="Port">
              <Input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                onBlur={() => saveSmtp()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-24"
              />
            </SettingRow>
            <SettingRow
              title="Encryption"
              description="STARTTLS for port 587, SSL/TLS for port 465, or None for unencrypted."
            >
              <div className="flex items-center gap-1 rounded-full border border-border p-1">
                {(
                  [
                    { id: "none", label: "None" },
                    { id: "starttls", label: "STARTTLS" },
                    { id: "ssl", label: "SSL/TLS" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSmtpEncryption(opt.id);
                      saveSmtp({ encryption: opt.id });
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      smtpEncryption === opt.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow title="Username">
              <Input
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                onBlur={() => saveSmtp()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-full sm:w-56"
              />
            </SettingRow>
            <SettingRow
              title="Password"
              description={
                settings.smtp.hasPassword
                  ? "A password is saved — leave blank to keep it."
                  : "No password saved yet."
              }
            >
              <div className="relative w-full sm:w-56">
                <Input
                  type={showSmtpPass ? "text" : "password"}
                  autoComplete="new-password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  onBlur={() => {
                    if (smtpPass) saveSmtp();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  placeholder={settings.smtp.hasPassword ? "••••••••" : ""}
                  className={cn("w-full", smtpPass && "pr-14")}
                />
                {smtpPass && (
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass((v) => !v)}
                    aria-label={showSmtpPass ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-8 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showSmtpPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                )}
              </div>
            </SettingRow>
            <SettingRow title="From address" description="The sender address readers will see.">
              <Input
                type="email"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                onBlur={() => saveSmtp()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                placeholder="library@yourdomain.com"
                className="w-full sm:w-56"
              />
            </SettingRow>
          </SectionCard>
          </div>
        )}

        {category === "backup" && (
          <div className="flex flex-col gap-3">
            <SectionCard
              title="Backup"
              description="Download a copy of your library so it lives somewhere other than this one bucket."
            >
              <SettingRow
                title="Include EPUB and cover files"
                description={
                  DEMO_MODE
                    ? "Backups are disabled on this read-only demo."
                    : includeFiles
                      ? `Adds every book's file — roughly ${formatBytes(totalBookBytes)} on top of metadata.`
                      : "Off downloads just metadata (ratings, shelves, tags, settings) — small and fast."
                }
              >
                <Switch
                  checked={includeFiles}
                  onCheckedChange={setIncludeFiles}
                  disabled={DEMO_MODE}
                />
              </SettingRow>
              <div className="flex justify-end py-4">
                <Button
                  variant="outline"
                  disabled={DEMO_MODE}
                  render={
                    DEMO_MODE ? undefined : (
                      <a href={`/api/backup${includeFiles ? "?files=1" : ""}`} download />
                    )
                  }
                  className="gap-2"
                >
                  <Archive className="size-4" />
                  Download backup
                </Button>
              </div>
            </SectionCard>
            {!DEMO_MODE && (
              <p className="px-1 text-xs text-muted-foreground">
                This is a one-way export — to restore, unzip it back into your storage bucket
                (preserving the folder structure) and restart the app.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
