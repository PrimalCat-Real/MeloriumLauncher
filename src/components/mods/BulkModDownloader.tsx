// components/mods/BulkModDownloader.tsx
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { Button } from '../ui/button';
import { CloudDownload, LoaderCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { toast } from 'sonner';
import { RootState } from '@/store/configureStore';
import { Mod, removeFromMissingMods, setModEnabled } from '@/store/slice/modsSlice';
import { useModsAudit } from '@/hooks/useModsAudit';

const BulkModDownloader = ({ modsPath }: { modsPath: string }) => {
  const dispatch = useDispatch();
  const mods = useSelector((s: RootState) => s.modsSlice.mods, shallowEqual);
  const missingMods = useSelector((s: RootState) => s.modsSlice.missingMods, shallowEqual);
  const { presets, activePresetId } = useSelector((s: RootState) => s.modsSlice, shallowEqual);

  const { downloadSelected, runAudit } = useModsAudit();
  const [loading, setLoading] = useState(false);

  const targetMissingMods = useMemo<Mod[]>(() => {
    const preset = presets.find((p) => p.id === activePresetId);
    if (!preset) return missingMods;
    if (preset.mods === 'all') return missingMods;
    const allowed = new Set<string>(preset.mods as string[]);
    const result: Mod[] = [];
    for (const m of missingMods) {
      if (allowed.has(m.id)) result.push(m);
    }
    return result;
  }, [presets, activePresetId, missingMods]);

  const handleDownloadAll = useCallback(async () => {
    if (targetMissingMods.length === 0) {
      toast('Нет отсутствующих модов для текущего пресета');
      return;
    }

    setLoading(true);
    try {
      await runAudit(modsPath);

      const files: string[] = [];
      for (const m of targetMissingMods) files.push(m.file);

      const { missingOnServer } = await downloadSelected(files);
      const missingSet = new Set<string>(missingOnServer);

      for (const m of targetMissingMods) {
        if (!missingSet.has(m.file)) {
          dispatch(removeFromMissingMods(m));
          dispatch(setModEnabled({ id: m.id, enabled: true }));
        }
      }
    } catch (e) {
      toast.error('Не удалось загрузить моды', { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [modsPath, targetMissingMods, runAudit, downloadSelected, dispatch]);

  if (!loading && targetMissingMods.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            onClick={handleDownloadAll}
            disabled={loading}
            aria-label="Download missing mods for active preset"
            className="inline-flex items-center p-2 rounded-full"
          >
            {loading ? <LoaderCircle className="animate-spin h-4 w-4" /> : <CloudDownload className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Скачать все</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default React.memo(BulkModDownloader);
