import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox, MultiCombobox, type ComboboxOption } from "@/components/Combobox";
import { COUNTRIES, CITIES, flagEmoji, flagForCountry } from "@/lib/job-location";
import {
  fetchProfile,
  accountDisplayName,
  accountInitials,
  type AccountProfile,
} from "@/lib/profile";
import { ExtensionPairing } from "@/components/ExtensionPairing";
import { LogoTile } from "@/components/Logo";
import { LOGO_THEMES, logoTheme } from "@/lib/logo-theme";
import {
  GENDER_GROUPS,
  GENDER_OPTIONS,
  PREFER_NOT_TO_SAY,
  PRONOUN_OPTIONS,
  pronounsLabel,
  toggleGender,
  togglePronoun,
} from "@/lib/gender";
import { toast } from "sonner";
import { z } from "zod";
import { Clock, Eye, EyeOff, MailCheck, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — Job Tracker" },
      {
        name: "description",
        content:
          "Manage your name, location, time zone, gender, pronouns, logo colours and password.",
      },
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

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

const profileSchema = z.object({
  first_name: z.string().trim().max(80),
  last_name: z.string().trim().max(80),
  nickname: z.string().trim().max(80),
  country: z.string().trim().max(120),
  city: z.string().trim().max(120),
  time_zone: z.string().trim().max(64),
});

type ProfileForm = z.infer<typeof profileSchema>;

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);

const pwSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer");

function formFromProfile(p: AccountProfile | null | undefined): ProfileForm {
  return {
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    nickname: p?.nickname ?? "",
    country: p?.country ?? "",
    city: p?.city ?? "",
    time_zone: p?.time_zone ?? "",
  };
}

function AccountPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  if (isLoading) return <AccountSkeleton />;

  return (
    <main className="container-narrow page-body">
      <header className="flex items-center gap-4 pb-8">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-foreground text-base font-medium text-background">
            {accountInitials(profile)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.02em]">
            {accountDisplayName(profile)}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {[pronounsLabel(profile?.pronouns, profile?.pronouns_description), profile?.email]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      <ProfileSection profile={profile} />

      <GenderSection profile={profile} />

      <LogoSection profile={profile} />

      <Section title="Sign-in & security" description="How you get into your account.">
        <div className="divide-y">
          <EmailRow currentEmail={profile?.email ?? ""} />
          <PasswordRow />
        </div>
      </Section>

      <Section
        title="Browser extension"
        description="Clip a job ad from any page, so you keep it after the posting comes down."
      >
        <ExtensionPairing />
      </Section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/** A settings group: what it is on the left, the controls on the right. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-12 gap-y-5 border-t py-8 md:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
  aside,
}: {
  id?: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={id ? `${id}-hint` : undefined} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function AccountSkeleton() {
  return (
    <main className="container-narrow page-body" aria-busy="true" aria-label="Loading account">
      <div className="flex items-center gap-4 pb-8">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-x-12 gap-y-5 border-t py-8 md:grid-cols-[14rem_1fr]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function ProfileSection({ profile }: { profile: AccountProfile | null | undefined }) {
  const queryClient = useQueryClient();
  const tzOptions = useMemo(timeZoneOptions, []);
  // Read after mount: the server's zone isn't the user's, and rendering it would break hydration.
  const [deviceTz, setDeviceTz] = useState<string | null>(null);
  useEffect(() => setDeviceTz(deviceTimeZone()), []);

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

  const saved = useMemo(() => formFromProfile(profile), [profile]);
  const [form, setForm] = useState<ProfileForm>(saved);
  useEffect(() => setForm(saved), [saved]);

  const dirty = (Object.keys(saved) as (keyof ProfileForm)[]).some(
    (k) => form[k].trim() !== saved[k],
  );

  const saveProfile = useMutation({
    mutationFn: async (values: ProfileForm) => {
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

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    saveProfile.mutate(parsed.data);
  };

  const set = (patch: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Section title="Profile" description="Your name and where you're based.">
      <form onSubmit={onSave} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="first_name" label="First name">
            <Input
              id="first_name"
              value={form.first_name}
              onChange={(e) => set({ first_name: e.target.value })}
              autoComplete="given-name"
            />
          </Field>
          <Field id="last_name" label="Surname">
            <Input
              id="last_name"
              value={form.last_name}
              onChange={(e) => set({ last_name: e.target.value })}
              autoComplete="family-name"
            />
          </Field>
        </div>

        <Field
          id="nickname"
          label="Nickname"
          aside={<span className="text-xs text-muted-foreground">Optional</span>}
          hint="Shown instead of your full name across the app."
        >
          <Input
            id="nickname"
            value={form.nickname}
            onChange={(e) => set({ nickname: e.target.value })}
            autoComplete="nickname"
            aria-describedby="nickname-hint"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City">
            <Combobox
              options={cityOptions}
              value={form.city}
              onSelect={(city, opt) => set({ city, country: opt?.hint ?? form.country })}
              onCustom={(city) => set({ city })}
              placeholder="Search a city…"
              searchPlaceholder="Type a city…"
              emptyText="No city found."
              allowCustom
              triggerIcon={<MapPin className="h-4 w-4 shrink-0 opacity-70" />}
            />
          </Field>
          <Field label="Country">
            <Combobox
              options={countryOptions}
              value={form.country}
              onSelect={(country) => set({ country })}
              placeholder="Select a country…"
              searchPlaceholder="Type a country…"
              emptyText="No country found."
              triggerIcon={
                form.country ? <span>{flagForCountry(form.country) || "🌐"}</span> : undefined
              }
            />
          </Field>
        </div>

        <Field
          label="Time zone"
          hint={
            deviceTz && deviceTz !== form.time_zone ? (
              <>
                Your device is on {deviceTz.replace(/_/g, " ")}.{" "}
                <button
                  type="button"
                  onClick={() => set({ time_zone: deviceTz })}
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Use it
                </button>
              </>
            ) : (
              "Used for company working hours and calendar sync."
            )
          }
        >
          <Combobox
            options={tzOptions}
            value={form.time_zone}
            onSelect={(time_zone) => set({ time_zone })}
            placeholder="Select a time zone…"
            searchPlaceholder="Type a zone or city…"
            emptyText="No time zone found."
            triggerIcon={<Clock className="h-4 w-4 shrink-0 opacity-70" />}
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-1">
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForm(saved)}
              disabled={saveProfile.isPending}
            >
              Discard
            </Button>
          )}
          <Button type="submit" disabled={!dirty || saveProfile.isPending}>
            {saveProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Gender & pronouns                                                   */
/* ------------------------------------------------------------------ */

type GenderForm = {
  identities: string[];
  description: string;
  pronouns: string[];
  pronounsDescription: string;
};

function genderFormFromProfile(p: AccountProfile | null | undefined): GenderForm {
  return {
    identities: p?.gender_identities ?? [],
    description: p?.gender_description ?? "",
    pronouns: p?.pronouns ?? [],
    pronounsDescription: p?.pronouns_description ?? "",
  };
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Identities as dropdown options, headed by group; "Prefer not to say" last. */
const IDENTITY_OPTIONS: ComboboxOption[] = [
  ...GENDER_OPTIONS.map((o) => ({
    value: o.id,
    label: o.label,
    hint: o.hint,
    keywords: `${o.label} ${o.hint ?? ""}`,
    group: GENDER_GROUPS.find((g) => g.id === o.group)?.label,
  })),
  { value: PREFER_NOT_TO_SAY, label: "Prefer not to say", group: "Or" },
];

const PRONOUN_DROPDOWN_OPTIONS: ComboboxOption[] = PRONOUN_OPTIONS.map((o) => ({
  value: o.id,
  label: o.label,
}));

/**
 * Optional gender identity and pronouns, as two multi-select dropdowns with
 * a free-text field under each. Pick as many as fit, add your own words, or
 * say you'd rather not — all private to you.
 */
function GenderSection({ profile }: { profile: AccountProfile | null | undefined }) {
  const queryClient = useQueryClient();
  const saved = useMemo(() => genderFormFromProfile(profile), [profile]);
  const [form, setForm] = useState<GenderForm>(saved);
  useEffect(() => setForm(saved), [saved]);

  const declined = form.identities.includes(PREFER_NOT_TO_SAY);

  const dirty =
    !sameIds(form.identities, saved.identities) ||
    !sameIds(form.pronouns, saved.pronouns) ||
    form.description.trim() !== saved.description ||
    form.pronounsDescription.trim() !== saved.pronounsDescription;

  const save = useMutation({
    mutationFn: async (values: GenderForm) => {
      if (!profile?.id) throw new Error("Not signed in");
      const declining = values.identities.includes(PREFER_NOT_TO_SAY);
      const { error } = await supabase
        .from("profiles")
        .update({
          gender_identities: values.identities.length ? values.identities : null,
          gender_description: (!declining && values.description.trim()) || null,
          pronouns: values.pronouns.length ? values.pronouns : null,
          pronouns_description: values.pronounsDescription.trim() || null,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gender & pronouns saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  const set = (patch: Partial<GenderForm>) => setForm((f) => ({ ...f, ...patch }));
  const shownAs = pronounsLabel(form.pronouns, form.pronounsDescription);

  return (
    <Section
      title="Gender & pronouns"
      description="Optional, and only you see it. Pick as many as fit you, or use your own words."
    >
      <form onSubmit={onSave} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="gender_identities" label="Gender identity">
            <MultiCombobox
              id="gender_identities"
              options={IDENTITY_OPTIONS}
              values={form.identities}
              onToggle={(id) => set({ identities: toggleGender(form.identities, id) })}
              onClear={() => set({ identities: [] })}
              placeholder="Select identities…"
              searchPlaceholder="Search identities…"
              emptyText="Not listed — add it in your own words."
            />
          </Field>
          <Field id="pronouns" label="Pronouns">
            <MultiCombobox
              id="pronouns"
              options={PRONOUN_DROPDOWN_OPTIONS}
              values={form.pronouns}
              onToggle={(id) => set({ pronouns: togglePronoun(form.pronouns, id) })}
              onClear={() => set({ pronouns: [] })}
              placeholder="Select pronouns…"
              searchPlaceholder="Search pronouns…"
              emptyText="Not listed — add them below."
            />
          </Field>
          <Field
            id="gender_description"
            label="In your own words"
            aside={<span className="text-xs text-muted-foreground">Optional</span>}
            hint={declined ? "Cleared while “Prefer not to say” is picked." : undefined}
          >
            <Input
              id="gender_description"
              value={declined ? "" : form.description}
              onChange={(e) => set({ description: e.target.value })}
              disabled={declined}
              maxLength={80}
              placeholder="e.g. genderfluid, leaning femme"
            />
          </Field>
          <Field
            id="pronouns_description"
            label="Other pronouns"
            aside={<span className="text-xs text-muted-foreground">Optional</span>}
            hint={shownAs ? `Shown under your name as “${shownAs}”.` : undefined}
          >
            <Input
              id="pronouns_description"
              value={form.pronounsDescription}
              onChange={(e) => set({ pronounsDescription: e.target.value })}
              maxLength={40}
              placeholder="e.g. ve/ver"
            />
          </Field>
        </div>

        {dirty && (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForm(saved)}
              disabled={save.isPending}
            >
              Discard
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </form>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Logo                                                                */
/* ------------------------------------------------------------------ */

const STANDARD_LOGO = "Standard";
const LOGO_GROUP_LABELS = { pride: "Pride", cause: "Movements", country: "Countries & regions" };

/**
 * Pick the colours of your own logo — standard, a pride flag, a movement, or a
 * country's — from one searchable dropdown. Saves on pick (no form), and
 * writes the cache first so the header tile changes the moment you choose.
 */
function LogoSection({ profile }: { profile: AccountProfile | null | undefined }) {
  const queryClient = useQueryClient();
  const current = logoTheme(profile?.logo_theme);

  // Values are names (unique across all themes) so search matches what you read.
  const options = useMemo<ComboboxOption[]>(
    () => [
      {
        value: STANDARD_LOGO,
        label: STANDARD_LOGO,
        icon: <LogoTile theme={null} className="h-4 w-4 rounded-[4px] [&>span]:hidden" />,
      },
      ...LOGO_THEMES.map((t) => ({
        value: t.name,
        label: t.name,
        group: LOGO_GROUP_LABELS[t.group],
        icon: <LogoTile theme={t} className="h-4 w-4" />,
      })),
    ],
    [],
  );

  const saveTheme = useMutation({
    mutationFn: async (id: string | null) => {
      if (!profile?.id) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ logo_theme: id })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["profile"] });
      const previous = queryClient.getQueryData<AccountProfile | null>(["profile"]);
      if (previous) {
        queryClient.setQueryData<AccountProfile>(["profile"], { ...previous, logo_theme: id });
      }
      return { previous };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["profile"], ctx.previous);
      toast.error(e instanceof Error ? e.message : "Could not change the logo");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  const pick = (id: string | null) => {
    if (id === (current?.id ?? null)) return;
    saveTheme.mutate(id);
  };

  return (
    <Section
      title="Logo"
      description="Show your colours: wear a flag on your Job Tracker logo. Only you see it."
    >
      <div className="flex items-end gap-4">
        <LogoTile theme={current} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <Field
            label="Logo colours"
            hint="Pride flags, movements, and every country's flag."
            aside={
              current && (
                <button
                  type="button"
                  onClick={() => pick(null)}
                  disabled={saveTheme.isPending}
                  className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Reset to standard
                </button>
              )
            }
          >
            <Combobox
              options={options}
              value={current?.name ?? STANDARD_LOGO}
              onSelect={(name) => pick(LOGO_THEMES.find((t) => t.name === name)?.id ?? null)}
              placeholder="Choose a flag…"
              searchPlaceholder="Search flags, countries, movements…"
              emptyText="No flag for that yet."
              triggerIcon={
                current ? (
                  <LogoTile theme={current} className="h-4 w-4" />
                ) : (
                  <LogoTile theme={null} className="h-4 w-4 rounded-[4px] [&>span]:hidden" />
                )
              }
            />
          </Field>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Sign-in & security                                                  */
/* ------------------------------------------------------------------ */

/**
 * A read-only setting that expands in place into a small form. Keeps the page
 * calm — sensitive fields only appear when the user asks to change them.
 */
function EditableRow({
  label,
  value,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  value: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  // Hand focus back to "Change" when the inline form closes.
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div
      className="py-4 first:pt-0 last:pb-0"
      onKeyDown={(e) => {
        if (open && e.key === "Escape") onOpenChange(false);
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="truncate text-sm text-muted-foreground">{value}</div>
        </div>
        {!open && (
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(true)}
          >
            Change
          </Button>
        )}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function EmailRow({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const changeEmail = useMutation({
    mutationFn: async (newEmail: string) => {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      return newEmail;
    },
    onSuccess: (newEmail) => {
      setSentTo(newEmail);
      setOpen(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not update email"),
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    setValue("");
    setError(undefined);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (parsed.data.toLowerCase() === currentEmail.toLowerCase())
      return setError("That's already your email");
    changeEmail.mutate(parsed.data);
  };

  return (
    <EditableRow
      label="Email"
      value={
        <>
          {currentEmail}
          {sentTo && !open && (
            <span className="mt-1 flex items-center gap-1.5 whitespace-normal text-xs text-foreground">
              <MailCheck className="h-3.5 w-3.5 shrink-0" />
              Check {sentTo} and click the link to finish the change.
            </span>
          )}
        </>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          id="new_email"
          label="New email"
          error={error}
          hint="We'll send a confirmation link. Nothing changes until you click it."
        >
          <Input
            id="new_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "new_email-error" : "new_email-hint"}
          />
        </Field>
        <FormActions
          pending={changeEmail.isPending}
          pendingLabel="Sending…"
          submitLabel="Send link"
          onCancel={() => onOpenChange(false)}
        />
      </form>
    </EditableRow>
  );
}

function PasswordRow() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string>();

  const changePassword = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setOpen(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not update password"),
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    setValue("");
    setVisible(false);
    setError(undefined);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = pwSchema.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    changePassword.mutate(parsed.data);
  };

  return (
    <EditableRow
      label="Password"
      value={<span aria-label="Password set">••••••••••</span>}
      open={open}
      onOpenChange={onOpenChange}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          id="new_password"
          label="New password"
          error={error}
          hint="At least 8 characters. You'll stay signed in on this device."
        >
          <div className="relative">
            <Input
              id="new_password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(undefined);
              }}
              className="pr-10"
              aria-invalid={!!error}
              aria-describedby={error ? "new_password-error" : "new_password-hint"}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <FormActions
          pending={changePassword.isPending}
          pendingLabel="Updating…"
          submitLabel="Update password"
          onCancel={() => onOpenChange(false)}
        />
      </form>
    </EditableRow>
  );
}

function FormActions({
  pending,
  pendingLabel,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  pendingLabel: string;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
