'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@/store/configureStore'
import { toggleMod, Mod, setModEnabled, applyPreset, saveFullPresetState } from '@/store/slice/modsSlice'
import Image from 'next/image'
import {
  ColumnDef,
  ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
  flexRender,
} from "@tanstack/react-table"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Input } from '../ui/input'
import { ArrowDownAZ, ArrowDownZA, Search } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import path from 'path'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '../ui/button'
import { cn, getDependants, getParents } from '@/lib/utils'
import ModToggle from './ModToggle'



// export 




const ModsTable = () => {
  const getModColumns = (onToggle: (mod: Mod, enabled: boolean) => void): ColumnDef<Mod>[] => [
    {
      accessorFn: row => row.name,
      id: "mod",
      header: ({ column }) => (
        <div className="flex items-center text-foreground/80 hover:text-foreground">
          <Button className='hover:bg-transparent !px-0.5 w-min mx-0 inline-flex' variant='ghost' onClick={() => toggleSorting(column)}>
            <span>Мод</span>
            {column.getIsSorted() === "asc" && <ArrowDownAZ className="w-4 h-4" />}
            {column.getIsSorted() === "desc" && <ArrowDownZA className="w-4 h-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-4">
          <Image
            src={row.original.image}
            alt={row.original.name}
            width={36}
            height={36}
            className="rounded"
          />
          <div className="flex flex-col">
            <span className="font-semibold">{row.original.name}</span>
            <span className="text-xs text-foreground/80">{row.original.description}</span>
          </div>
        </div>
      ),
      filterFn: "includesString",
      enableSorting: true,
      enableHiding: false,
      minSize: 200,
    },
    {
      id: "enabled",
      header: "",
      cell: ({ row }) => (
        <ModToggle mod={row.original} onToggle={onToggle}></ModToggle>
        // <Switch
        //   className="transform-gpu origin-center scale-[1.2] cursor-pointer"
        //   checked={row.original.enabled}
        //   onCheckedChange={(value) => onToggle(row.original, value)}
        //   aria-label="Включить мод"
        // />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
      maxSize: 50,
    },
  ]



  const dispatch = useDispatch()
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir)
  const modsPath = path.join(gameDir, "Melorium", "mods")
  const mods = useSelector((state: RootState) => state.modsSlice.mods)
  const [sorting, setSorting] = useState<SortingState>([{ id: "mod", desc: false }])

  const toggleSorting = (column: any) => {
  const currentSorting = column.getIsSorted();
  if (currentSorting === "asc") {
      setSorting([{ id: column.id, desc: true }]);
    } else {
      setSorting([{ id: column.id, desc: false }]);
    }
  };
  useEffect(() => {
    const loadModFiles = async () => {
      const files: string[] = await invoke('list_mod_jar_files', { modsPath });
      files.map((file) => {
        let fileName = file.split(/[/\\]/).pop()!
        const isDisabled = fileName.endsWith(".jar.disabled");
        const baseFileName = fileName.endsWith('.jar.disabled')
          ? fileName.replace(/\.disabled$/, '')
          : fileName;

        const modMatch = mods.find(mod => mod.file === baseFileName);
        if(modMatch){
          dispatch(setModEnabled({
            id: modMatch.id,
            enabled: !isDisabled
        }));
        }
        
      })
    }
    loadModFiles()

    const handleFocus = () => loadModFiles()
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  },[modsPath, dispatch, mods])
  

  // const onModToggle = useCallback(async (mod: Mod, newEnabled: boolean) => {
  //     const modsDir = path.join(gameDir, "Melorium", "mods");

  //     let idsToToggle: string[];

  //     if (newEnabled) {
  //         // При включении мода добавляем его и его родительские моды (зависимости)
  //         const parents = getParents(mod.id, mods);
  //         idsToToggle = [mod.id, ...parents];
  //     } else {
  //         // При отключении мода добавляем его и его дочерние моды (зависимости)
  //         idsToToggle = [mod.id, ...getDependants(mod.id, mods)];
  //     }

  //     // Подготовка списка файлов для изменения состояния (включения/выключения)
  //     const filesToTouch = idsToToggle.map(id => {
  //         const m = mods.find(x => x.id === id)!;
  //         const filePath = path.join(modsDir, m.file);
  //         return { id, filePath, targetState: newEnabled };
  //     });

  //     // Если мод отключается, добавляем его и все зависимые моды в список исключений для git reset
  //     if (!newEnabled) {
  //         const filesToAssume = filesToTouch.map(file => file.filePath);
  //         await invoke('update_index', {
  //             args: {
  //                 base_dir: modsDir,
  //                 files: filesToAssume
  //             }
  //         });
  //     }

  //     // Выполнение реального включения/выключения модов
  //     const promises = filesToTouch.map(({ id, filePath, targetState }) =>
  //         invoke("toggle_mod_file", { path: filePath, enable: targetState }).catch(err =>
  //             toast.error(`Не удалось ${targetState ? "включить" : "отключить"} ${id}`, {
  //                 description: String(err),
  //             })
  //         )
  //     );

  //     await Promise.allSettled(promises);

  //     // Обновление состояния модов в хранилище
  //     idsToToggle.forEach(id =>
  //         dispatch(setModEnabled({ id, enabled: newEnabled }))
  //     );
  // }, [gameDir, mods, dispatch]);
  const onModToggle = useCallback(async (mod: Mod, newEnabled: boolean) => {
    
    const modsDir = path.join(gameDir, "Melorium", "mods")

    let idsToToggle: string[]

    

    if (newEnabled) {
      const parents = getParents(mod.id, mods)
      idsToToggle = [mod.id, ...parents]
    } else {
      idsToToggle = [mod.id, ...getDependants(mod.id, mods)]
    }

    const filesToTouch = idsToToggle.map(id => {
      const m = mods.find(x => x.id === id)!
      const filePath = path.join(modsDir, m.file)
      return { id, filePath, targetState: newEnabled }
    })

    if (!newEnabled) {
        
        const filesToAssume = filesToTouch.map(file => file.filePath);
        console.log(filesToAssume)
        await invoke('skip_worktree', {
            args: {
                base_dir:  path.join(gameDir, "Melorium", "mods"),
                files: filesToAssume
            }
        });
    }


    const promises = filesToTouch.map(({ id, filePath, targetState }) =>
      invoke("toggle_mod_file", { path: filePath, enable: targetState }).catch(err =>
        toast.error(`Не удалось ${targetState ? "включить" : "отключить"} ${id}`, {
          description: String(err),
        })
      )
      
    )

    await Promise.allSettled(promises)

    idsToToggle.forEach(id =>
      dispatch(setModEnabled({ id, enabled: newEnabled }))
    )
  }, [gameDir, mods, dispatch]);

  
  

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  
  const { presets, activePresetId } = useSelector((state: RootState) => state.modsSlice)
  
  const visibleMods = useMemo(() => {
    const activePreset = presets.find(p => p.id === activePresetId);
    if (!activePreset) return mods;

    if (activePreset.mods === "all") return mods;
    
    console.log("mods", mods.filter(mod => activePreset.mods.includes(mod.id)))
    return mods.filter(mod => activePreset.mods.includes(mod.id));
  }, [mods, presets, activePresetId]);

  const columns = useMemo(() => getModColumns(onModToggle), [onModToggle])
  const table = useReactTable({
    data: visibleMods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
    },
  })

  const handlePreset = async (id: string) => {
    // dispatch(saveFullPresetState({
    //   presetId: activePresetId,
    //   mods: mods.map(mod => ({ id: mod.id, enabled: !!mod.enabled }))
    // }))
    dispatch(applyPreset(id))

    // const preset = presets.find(p => p.id === id)
    // if (!preset) return

    // const allowedIds = preset.mods === "all"
    //   ? mods.map(m => m.id)
    //   : preset.mods

    // const allowedSet = new Set(allowedIds)

    // console.log(allowedSet)
    // for (const mod of mods) {
    //   // const shouldBeEnabled = allowedSet.has(mod.id)
    //   // const isEnabled = !!mod.enabled

    //   // if (shouldBeEnabled !== isEnabled) {
    //   //   await onModToggle(mod, shouldBeEnabled)
    //   // }
    // }
  }

  return (
    <div className="w-full z-10 flex flex-col gap-4">

      <div className="flex items-center gap-2">
        <div className="relative max-w-xs w-full mr-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground pointer-events-none" />
          <Input
            placeholder="Поиск по названию мода"
            value={(table.getColumn("mod")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("mod")?.setFilterValue(e.target.value)}
            className="pl-8"
          />
        </div>
        {presets.map(preset => (
          <Tooltip key={preset.id} delayDuration={400}>
            <TooltipTrigger>
              <Button
                className={cn(activePresetId === preset.id && "!bg-secondary ", "rounded-2xl")}
                key={preset.id}
                size="sm"
                variant={"outline"}
                onClick={() => handlePreset(preset.id)}
              >
                <span className={cn(activePresetId === preset.id ? "text-foreground" : "outline-btn-text-gradient")}>{preset.name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{preset.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
      </div>

      <div className="rounded-sm border border-border/80 outline-btn-bg max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-border scrollbar-track-background">
        <Table className='rounded-sm'>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Нет результатов.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default ModsTable
