import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Pairing for the "Clip to Job Tracker" browser extension.
 *
 * The code is a signed token minted for the signed-in user and shown once on
 * demand — it isn't stored anywhere, and it's separate from the calendar feed
 * token so a shared calendar URL can never be used to write applications.
 */
export function ExtensionPairing() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mint = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) throw new Error("Sign in again to create a pairing code");

      const res = await fetch("/clip/token", {
        method: "POST",
        headers: { authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error("Could not create a pairing code");
      const body = (await res.json()) as { token?: string };
      if (!body.token) throw new Error("Could not create a pairing code");
      return body.token;
    },
    onSuccess: (token) => setCode(token),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create a code"),
  });

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the code and copy it manually.");
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Puzzle className="h-4 w-4" /> Browser extension
        </CardTitle>
        <CardDescription>
          Clip a job ad straight from the page you're looking at — salary, requirements and the full
          text — so you still have it when the posting comes down. Pair once per browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {code ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Paste this into the extension. Treat it like a password — anyone with it can add
              applications to your account.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs whitespace-nowrap">
                {code}
              </code>
              <Button type="button" variant="outline" onClick={copy} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => mint.mutate()}
            disabled={mint.isPending}
          >
            {mint.isPending ? "Creating…" : "Show my pairing code"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
