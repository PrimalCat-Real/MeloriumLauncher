'use client';

import React, { memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderSearch } from "lucide-react";
import { cn } from "@/lib/utils";

type SetupProps = {
  selectedPath?: string;
  onPickPath?: () => void; // делаем опциональным
  onStart: () => void;
  canStart: boolean;
  startLabel?: string;
  hidePathPicker?: boolean; // новое свойство
};

type ProgressProps = {
  stage: string;
  percent: number;
  downloaded?: string;
  total?: string;
  speed?: string;
  eta?: string;
  canClose?: boolean;
  onClose?: () => void;
  hideTransferStats?: boolean; // NEW: hide ETA/speed/amount grid
};

type Props =
  | {
      mode: "setup";
      title: string;
      setup: SetupProps;
    }
  | ({
      mode: "progress";
      title: string;
    } & ProgressProps);

const ProgressPanel: React.FC<Props> = (props) => {
  const handlePickPath = useCallback(() => {
    if (props.mode === "setup" && props.setup.onPickPath) props.setup.onPickPath();
  }, [props]);


  const handleStart = useCallback(() => {
    if (props.mode === "setup") props.setup.onStart();
  }, [props]);

  const handleClose = useCallback(() => {
    if (props.mode === "progress" && props.onClose) props.onClose();
  }, [props]);

  const isUnpacking = useMemo(() => {
    // Hide ETA/speed/downloaded during unpacking stage
    if (props.mode !== "progress") return false;
    return /распаков/i.test(props.stage);
  }, [props]);

  return (
    <div className="space-y-4">
      <div className="text-md font-medium">{props.title}</div> 

      {props.mode === "setup" ? (
        <div className="space-y-4">
          {!props.setup.hidePathPicker && (
            <div className="text-sm">
              <Button
                variant="outline"
                className="w-full text-start justify-between px-8 flex"
                onClick={handlePickPath}
              >
                <span
                  className={cn(
                    "text-ellipsis whitespace-nowrap min-w-0 [direction:rtl] text-left overflow-hidden",
                    !props.setup.selectedPath?.replace("/", "\\") && "[direction:ltr]"
                  )}
                >
                  {props.setup.selectedPath
                    ? props.setup.selectedPath.replace("/", "\\")
                    : "Выбрать путь..."}
                </span>
                <FolderSearch />
              </Button>
            </div>
          )}


          <div className="flex">
            <Button className="w-full" onClick={handleStart} disabled={!props.setup.canStart}>
              {props.setup.startLabel || "Скачать"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* <div className="flex items-center justify-between text-sm">
            <span>{props.stage}</span>
            <span>{Math.floor(props.percent)}%</span>
          </div> */}
          <Progress className="h-3 w-full" value={props.percent} max={100} />

          {!isUnpacking && !props.hideTransferStats && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex gap-2 items-center">
                
                <div className="truncate outline-btn-text-gradient">ETA {props.eta || "--:--"}</div>
                <div className="truncate outline-btn-text-gradient">
                  {Math.floor(props.percent)}%
                  {/* {props.downloaded && props.total ? (
                    `${props.downloaded} / ${props.total}`
                  ) : (
                    <Skeleton className="h-4 w-28" />
                  )} */}
                </div>
              </div>
              {!isUnpacking && (<div className="text-right outline-btn-text-gradient">
                {props.speed ? props.speed : <Skeleton className="h-4 w-20 ml-auto" />}
              </div>)}

              <div />
            </div>
          )}
          {props.canClose && (
            <div className="flex justify-end">
              <Button onClick={handleClose}>Закрыть</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(ProgressPanel);
