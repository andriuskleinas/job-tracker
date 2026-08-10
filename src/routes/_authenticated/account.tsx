import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/Combobox";
import { COUNTRIES, CITIES, flagEmoji, flagForCountry } from "@/lib/job-location";
import { toast } from "sonner";
import { z } from "zod";
import { Clock, LocateFixed, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — Job Tracker" },
      { name: "description", content: "Manage your name, location, time zone and password." },
      { property: "og:title", content: "Account — Job Tracker" },
      { property: "og:description", content: "Manage your account details." },
    ],
  }),
  component: AccountPage,
});

/** IANA zones the browser knows about, with a small fallback for older engines. */
function timeZoneOptions() {
  const supported =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : null;
  const zones = supported ?? ["UTC", "Europe/London", "America/New_York", "America/Los_Angeles"];
  return zones.map((z) => ({
    value: z,
    label: z.replace(/_/g, " "),
    keywords: z.replace(/[/_]/g, " "),
  }));
}

const profileSchema = z.object({
  first_name: z.string().trim().max(80),
  last_name: z.string().trim().max(80),
  nickname: z.string().trim().max(80),
  country: z.string().trim().max(120),
  city: z.string().trim().max(120),
  time_zone: z.string().trim().max(64),
});

const pwSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function AccountPage() {
  const queryClient = useQueryClient();
  const tzOptions = useMemo(timeZoneOptions, []);

  const countryOptions = useMemo(
    () =>
      COUNTRIES.map((c) => ({
        value: c.name,
        label: c.name,
        keywords: c.name,
        icon: <span>{flagEmoji(c.code)}</span>,
      })),
    [],
  );

  // City picker also carries its country so choosing a city fills both fields.
  const cityOptions = useMemo(
    () =>
      CITIES.map((c) => ({
        value: c.city,
        label: c.city,
        hint: c.country,
        keywords: `${c.city} ${c.country}`,
        icon: <span>{flagEmoji(c.code)}</span>,
      })),
    [],
  );

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return { ...data, email: data?.email ?? userData.user?.email ?? null, id: uid };
    },
  });

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    nickname: "",
    country: "",
    city: "",
    time_zone: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        nickname: profile.nickname ?? "",
        country: profile.country ?? "",
        city: profile.city ?? "",
        time_zone: profile.time_zone ?? "",
      });
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async (values: z.infer<typeof profileSchema>) => {
      if (!profile?.id) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          nickname: values.nickname || null,
          country: values.country || null,
          city: values.city || null,
          time_zone: values.time_zone || null,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const changePassword = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Password updated"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update password"),
  });

  const onSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    saveProfile.mutate(parsed.data);
  };

  const onChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = pwSchema.safeParse({
      password: fd.get("password"),
      confirm: fd.get("confirm"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const formEl = e.currentTarget;
    changePassword.mutate(parsed.data.password, { onSuccess: () => formEl.reset() });
  };

  const detectTimeZone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        setForm((f) => ({ ...f, time_zone: tz }));
        toast.success(`Set to ${tz.replace(/_/g, " ")}`);
      }
    } catch {
      toast.error("Couldn't detect your time zone");
    }
  };

  if (isLoading)
    return (
      <main className="container-narrow page-body text-sm text-muted-foreground">Loading…</main>
    );

  return (
    <main className="container-narrow page-body">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {profile?.email ?? "Manage your profile and password."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your name and where you're based.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Surname</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                placeholder="What should we call you?"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                autoComplete="nickname"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Combobox
                  options={cityOptions}
                  value={form.city}
                  onSelect={(city, opt) =>
                    setForm({ ...form, city, country: opt?.hint ?? form.country })
                  }
                  onCustom={(city) => setForm({ ...form, city })}
                  placeholder="Search a city…"
                  searchPlaceholder="Type a city…"
                  emptyText="No city found."
                  allowCustom
                  triggerIcon={<MapPin className="h-4 w-4 shrink-0 opacity-70" />}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Combobox
                  options={countryOptions}
                  value={form.country}
                  onSelect={(country) => setForm({ ...form, country })}
                  placeholder="Select a country…"
                  searchPlaceholder="Type a country…"
                  emptyText="No country found."
                  triggerIcon={
                    form.country ? <span>{flagForCountry(form.country) || "🌐"}</span> : undefined
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Time zone</Label>
                <button
                  type="button"
                  onClick={detectTimeZone}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <LocateFixed className="h-3.5 w-3.5" /> Detect
                </button>
              </div>
              <Combobox
                options={tzOptions}
                value={form.time_zone}
                onSelect={(tz) => setForm({ ...form, time_zone: tz })}
                placeholder="Select a time zone…"
                searchPlaceholder="Type a zone or city…"
                emptyText="No time zone found."
                triggerIcon={<Clock className="h-4 w-4 shrink-0 opacity-70" />}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>
            Use at least 8 characters. You'll stay signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
