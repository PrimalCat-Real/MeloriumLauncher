'use client'
import React, { memo, useEffect, useState } from 'react'
import { Switch } from '../ui/switch'
import type { Mod } from '@/store/slice/modsSlice';

interface ModToggleProps {
  mod: Mod;
  onToggle: (mod: Mod, enabled: boolean) => void;
}

const ModToggle = memo(({ mod, onToggle }: ModToggleProps) => {
  const [checked, setChecked] = useState(mod.enabled);

  useEffect(() => {
    if (mod.enabled !== checked) {
      setChecked(mod.enabled);
    }
  }, [mod.enabled]);

  const handleChange = (value: boolean) => {
    setChecked(value);
    requestIdleCallback?.(() => onToggle(mod, value)) ||
      setTimeout(() => onToggle(mod, value), 100);
  };
  
  return (
    <Switch
        className="transform-gpu origin-center scale-[1.2] cursor-pointer"
        checked={checked}
        onCheckedChange={handleChange}
        aria-label="Включить мод"
    />
  )
})

export default ModToggle