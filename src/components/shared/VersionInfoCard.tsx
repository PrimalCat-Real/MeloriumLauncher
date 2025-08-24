'use client'

import React, { useEffect, useMemo, useState, useCallback, useTransition, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getVersion } from "@tauri-apps/api/app";

import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Versions = {
  current: string;
  server: string;
  update: Update | null;
  error?: string;
};

type RowProps = { label: string; value: string };

const Row = ({ label, value }: RowProps) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-mono text-sm">{value}</span>
  </div>
);

const VersionInfoCard = () => {
  const [data, setData] = useState<Versions | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    const run = async (): Promise<void> => {
      try {
        const current = await getVersion();
        const update = await check();
        const server = update?.version ?? current;
        if (!mounted) return;
        setData({ current, server, update });
      } catch (err) {
        if (!mounted) return;
        setData({
          current: "unknown",
          server: "unknown",
          update: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const status = useMemo(() => {
    if (!data) return { label: "checking", variant: "secondary" as const };
    if (data.error) return { label: "error", variant: "destructive" as const };
    if (data.update) return { label: "update available", variant: "default" as const };
    return { label: "up to date", variant: "outline" as const };
  }, [data]);

  const handleInstallUpdate = useCallback(() => {
    if (!data?.update) return;
    startTransition(async () => {
      try {
        await data.update?.downloadAndInstall();
        await relaunch();
      } catch (err) {
        setData((prev) => {
          const prevSafe = prev ?? { current: "unknown", server: "unknown", update: null };
          return { ...prevSafe, error: err instanceof Error ? err.message : String(err), update: null };
        });
      }
    });
  }, [data, startTransition]);

  if (!data) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current</span>
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Server</span>
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Row label="Current" value={data.current} />
      <Row label="Server" value={data.server} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <div>{status.label}</div>
      </div>
      {data.update ? (
        <div className="pt-2">
          <Button onClick={handleInstallUpdate} disabled={isPending}>
            {isPending ? "Installing..." : `Install ${data.server}`}
          </Button>
        </div>
      ) : null}
      {data.error ? (
        <p className="text-xs text-destructive">Error: {data.error}</p>
      ) : null}
    </div>
  );
};

export default VersionInfoCard;
