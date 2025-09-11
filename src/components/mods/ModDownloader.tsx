// components/mods/ModDownloader.tsx
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { Button } from '../ui/button';
import { Download, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { RootState } from '@/store/configureStore';
import { getParents } from '@/lib/utils';
import { Mod, removeFromMissingMods, setModEnabled } from '@/store/slice/modsSlice';
import { useModsAudit } from '@/hooks/useModsAudit';

interface ModDownloaderProps {
  mod: Mod;
  modsPath: string;
}

const ModDownloader = ({ mod, modsPath }: ModDownloaderProps) => {
  const dispatch = useDispatch();
  const mods = useSelector((s: RootState) => s.modsSlice.mods, shallowEqual);
  const [downloading, setDownloading] = useState(false);
  const { downloadSelected, runAudit } = useModsAudit();

  const collectWithDependencies = useCallback(
    (target: Mod, allMods: Mod[], acc: Mod[] = []) => {
      if (acc.find((m) => m.id === target.id)) return acc;
      acc.push(target);
      const parents = getParents(target.id, allMods);
      for (const parentId of parents) {
        const parent = allMods.find((m) => m.id === parentId);
        if (parent) collectWithDependencies(parent, allMods, acc);
      }
      return acc;
    },
    []
  );

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      // ensure audit has modsDir for later downloads
      await runAudit(modsPath);

      const toFetch = collectWithDependencies(mod, mods);
      const files: string[] = [];
      for (const m of toFetch) files.push(m.file);

      const { missingOnServer } = await downloadSelected(files);

      // update store for succeeded ones
      const missingSet = new Set<string>(missingOnServer);
      for (const m of toFetch) {
        if (!missingSet.has(m.file)) {
          dispatch(removeFromMissingMods(m));
          dispatch(setModEnabled({ id: m.id, enabled: true }));
        }
      }
    } catch (e) {
      toast.error('Не удалось загрузить мод(ы)', { description: String(e) });
    } finally {
      setDownloading(false);
    }
  }, [mod, mods, modsPath, runAudit, downloadSelected, dispatch]);

  return (
    <Button
      size="none"
      className="inline-flex px-2 py-4"
      variant="outline"
      disabled={downloading}
      onClick={handleDownload}
      aria-label="Download selected mod with dependencies"
    >
      {downloading ? <LoaderCircle className="animate-spin text-secondary" /> : <Download />}
    </Button>
  );
};

export default React.memo(ModDownloader);
