import React, { useCallback, useEffect, useState } from 'react';
import { Slider } from '../../components/ui/slider';
import { cn } from '../../lib/utils';
import { Input } from '../../components/ui/input';
import { maxRamState, selectedRamState } from '../state/systemInfo';
import { useRecoilState } from 'recoil';


const MIN_RAM_MB = 1024;
const STEP_MB = 256;
const FALLBACK_MAX_RAM_MB = 8192;
const FALLBACK_DEFAULT_RAM_MB = Math.max(MIN_RAM_MB, Math.round(FALLBACK_MAX_RAM_MB / 2 / STEP_MB) * STEP_MB);

const RamSelector = ({ className }: { className?: string }) => {
    const [currentMaxRamMb, setMaxRamAtom] = useRecoilState(maxRamState);
    const [committedRamValue, setCommittedRamAtom] = useRecoilState(selectedRamState);
    const [inputValue, setInputValue] = useState<string>(String(committedRamValue));

    useEffect(() => {
        const currentNumericInput = parseInt(inputValue, 10);
        const inputElement = document.querySelector('.ram-input');
         if (document.activeElement !== inputElement && (isNaN(currentNumericInput) || currentNumericInput !== committedRamValue)) {
             setInputValue(String(committedRamValue));
         }
    }, [committedRamValue, inputValue]);

    useEffect(() => {
        const fetchAndSetRam = async () => {
            let detectedMaxRam = FALLBACK_MAX_RAM_MB;
            let calculatedDefaultRam = FALLBACK_DEFAULT_RAM_MB;
            try {
                if (window.launcherAPI?.system?.getRamMB) {
                    const systemRam = await window.launcherAPI.system.getRamMB();
                    if (systemRam && systemRam >= MIN_RAM_MB * 2) {
                        detectedMaxRam = systemRam;
                        let defaultRam = Math.max(MIN_RAM_MB, Math.floor(detectedMaxRam / 2));
                        defaultRam = Math.round(defaultRam / STEP_MB) * STEP_MB;
                        calculatedDefaultRam = Math.max(MIN_RAM_MB, Math.min(defaultRam, detectedMaxRam));
                    }
                }
            } catch (error) {
                console.error('[RamSelector] Error fetching system RAM via launcherAPI:', error);
            } finally {
                setMaxRamAtom(detectedMaxRam);
                if (committedRamValue === FALLBACK_DEFAULT_RAM_MB) {
                     setCommittedRamAtom(calculatedDefaultRam);
                }
            }
        };
        if (currentMaxRamMb === null) {
            fetchAndSetRam();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setMaxRamAtom, setCommittedRamAtom, currentMaxRamMb]);

    const handleSliderChange = useCallback((value: number[]) => {
        const newRam = value[0];
        setCommittedRamAtom(newRam);
    }, [setCommittedRamAtom]);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
    }, []);

    const handleInputBlur = useCallback(() => {
        if (currentMaxRamMb === null) return;

        let numericValue = parseInt(inputValue, 10);

        if (isNaN(numericValue) || inputValue.trim() === '') {
            numericValue = MIN_RAM_MB;
        }

        const clampedValue = Math.max(MIN_RAM_MB, Math.min(numericValue, currentMaxRamMb));
        const roundedValue = Math.round(clampedValue / STEP_MB) * STEP_MB;
        const finalValue = Math.max(MIN_RAM_MB, Math.min(roundedValue, currentMaxRamMb));

        setCommittedRamAtom(finalValue);
    }, [inputValue, currentMaxRamMb, setCommittedRamAtom]);

    if (currentMaxRamMb === null) {
        return (
            <div className={cn('flex items-center justify-center gap-4 w-full h-16', className)}>
                <span className="text-sm text-muted-foreground animate-pulse">Определение ОЗУ...</span>
            </div>
        );
    }

    return (
        <div className={cn('flex items-center gap-4 w-full', className)}>
            <div className='flex flex-col w-full gap-1'>
                <Slider
                    className="w-full"
                    value={[committedRamValue]}
                    onValueChange={handleSliderChange}
                    min={MIN_RAM_MB}
                    max={currentMaxRamMb}
                    step={STEP_MB}
                    aria-label="Выбор оперативной памяти"
                />
                <div className='flex text-xs text-muted-foreground justify-between items-center px-1'>
                    <span>{MIN_RAM_MB} MB</span>
                    <span>{currentMaxRamMb} MB</span>
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-[75px] text-right tabular-nums ram-input border-border/80 bg-accent"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    aria-label="Ввод оперативной памяти в МБ"
                />
                <span className="text-sm text-muted-foreground">MB</span>
            </div>
        </div>
    );
};

export default RamSelector;