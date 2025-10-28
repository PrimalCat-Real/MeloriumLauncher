'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import { RootState } from '@/store/configureStore'
import { Mod, setModEnabled, setMissingMods, applyPresetOnce } from '@/store/slice/modsSlice'
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
import { ArrowDownAZ, ArrowDownZA, ArrowUpDown, List, Search } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import path from 'path'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Button } from '../ui/button'
import { cn, getDependants, getParents } from '@/lib/utils'
import ModToggle from './ModToggle'
import ModDownloader from './ModDownloader'
import BulkModDownloader from './BulkModDownloader'

const ModsTable: React.FC = () => {
  const dispatch = useDispatch()
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir)
  const mods = useSelector((state: RootState) => state.modsSlice.mods, shallowEqual)
  const missingMods = useSelector((state: RootState) => state.modsSlice.missingMods, shallowEqual)
  const { presets, isApplyingPreset } = useSelector((state: RootState) => state.modsSlice, shallowEqual)

  const modsPath = path.join(gameDir || '', 'Melorium', 'mods')

  const [sorting, setSorting] = useState<SortingState>([{ id: 'mod', desc: false }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ status: false })

  const toggleSorting = useCallback((column: any) => {
    const currentSorting = column.getIsSorted()
    if (currentSorting === 'asc') setSorting([{ id: column.id, desc: true }])
    else setSorting([{ id: column.id, desc: false }])
  }, [])

  const toggleSortByEnabled = useCallback(() => {
    setSorting(prev => {
      const cur = prev.find(s => s.id === 'status')
      if (!cur) return [{ id: 'status', desc: true }]
      if (cur.desc) return [{ id: 'status', desc: false }]
      return []
    })
  }, [])

  const onModToggle = useCallback(
    async (mod: Mod, newEnabled: boolean) => {
      const modsDir = path.join(gameDir || '', 'Melorium', 'mods')
      let idsToToggle: string[]
      if (newEnabled) {
        const parents = getParents(mod.id, mods)
        idsToToggle = [mod.id, ...parents]
      } else {
        idsToToggle = [mod.id, ...getDependants(mod.id, mods)]
      }

      const filesToTouch = idsToToggle.map((id) => {
        const m = mods.find((x) => x.id === id)!
        const filePath = path.join(modsDir, m.file)
        return { id, filePath, targetState: newEnabled }
      })

      if (!newEnabled) {
        const filesToAssume = filesToTouch.map((file) => file.filePath)
        // await invoke('skip_worktree', {
        //   args: { base_dir: path.join(gameDir || '', 'Melorium', 'mods'), files: filesToAssume },
        // }).catch(() => undefined)
      }

      const promises = filesToTouch.map(({ id, filePath, targetState }) =>
        invoke('toggle_mod_file', { path: filePath, enable: targetState }).catch((err) =>
          toast.error(`Не удалось ${targetState ? 'включить' : 'отключить'} ${id}`, { description: String(err) })
        )
      )
      await Promise.allSettled(promises)
      idsToToggle.forEach((id) => dispatch(setModEnabled({ id, enabled: newEnabled })))
    },
    [gameDir, mods, dispatch]
  )

  const columns = useMemo<ColumnDef<Mod>[]>(() => [
    {
      accessorFn: (row) => row.name,
      id: 'mod',
      header: ({ column }) => (
        <div className="flex items-center text-foreground/80 hover:text-foreground">
          <Button className="hover:bg-transparent !px-0.5 w-min mx-0 inline-flex" variant="ghost" onClick={() => toggleSorting(column)}>
            <span>Мод</span>
            {column.getIsSorted() === 'asc' && <ArrowDownAZ className="w-4 h-4" />}
            {column.getIsSorted() === 'desc' && <ArrowDownZA className="w-4 h-4" />}
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-4">
          <Image src={row.original.image} alt={row.original.name} width={36} height={36} className="rounded" />
          <div className="flex flex-col">
            <span className="font-semibold">{row.original.name}</span>
            <Tooltip delayDuration={1700}>
              <TooltipTrigger asChild>
                <span className="text-xs text-foreground/80 max-w-sm overflow-hidden truncate">
                  {row.original.description}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-fit max-w-xl text-wrap">{row.original.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ),
      filterFn: 'includesString',
      enableSorting: true,
      enableHiding: false,
      minSize: 200,
    },
    {
      id: 'status',
      accessorFn: (row: Mod) => {
        const isMissing = missingMods.some((m) => m.id === row.id)
        const isEnabled = !!row.enabled && !isMissing
        return isEnabled ? 1 : 0
      },
      header: () => null,
      enableSorting: true,
      enableHiding: true,
      size: 0,
      cell: () => null,
      sortingFn: (rowA, rowB, columnId) => {
        const a = Number(rowA.getValue(columnId))
        const b = Number(rowB.getValue(columnId))
        return a - b
      },
    },
    {
      id: 'enabled',
      header: () => (
        <div className="flex items-center justify-end pr-4 gap-2">
          <BulkModDownloader modsPath={modsPath} />
          <Button size="icon" variant={'outline'} onClick={toggleSortByEnabled} aria-label="Sort by enabled" className="inline-flex items-center p-2 rounded-full">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex w-full items-center justify-end pr-4">
          {missingMods?.find((mod) => mod.id === row.original.id)
            ? <ModDownloader modsPath={modsPath} mod={row.original} />
            : <ModToggle mod={row.original} onToggle={onModToggle} />
          }
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
      maxSize: 50,
    },
  ], [onModToggle, missingMods, modsPath, toggleSorting, toggleSortByEnabled])

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const visibleMods = useMemo(() => mods, [mods])

  const table = useReactTable({
    data: visibleMods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: { columnFilters, sorting, columnVisibility },
  })

  useEffect(() => {
    let cachedState: Record<string, boolean> = {}

    const loadModFiles = async () => {
      try {
        const files: string[] = await invoke('list_mod_jar_files', { modsPath })
        const newEnabledMap: Record<string, boolean> = {}
        let remainingMods: Mod[] = [...mods]

        for (const file of files) {
          const fileName = file.split(/[/\\]/).pop()!
          const isDisabled = fileName.endsWith('.jar.disabled')
          const baseFileName = isDisabled ? fileName.replace(/\.disabled$/, '') : fileName
          const modMatch = mods.find((mod) => mod.file === baseFileName)
          // console.log('Found mod file:', fileName, 'Matched mod:', modMatch?.id)
          if (modMatch) {
            const shouldBeEnabled = !isDisabled
            newEnabledMap[modMatch.id] = shouldBeEnabled
            if (cachedState[modMatch.id] !== shouldBeEnabled && modMatch.enabled !== shouldBeEnabled) {
              dispatch(setModEnabled({ id: modMatch.id, enabled: shouldBeEnabled }))
            }
            remainingMods = remainingMods.filter((mod) => mod.id !== modMatch.id)
          }
        }

        cachedState = { ...newEnabledMap }

        if (missingMods.length !== remainingMods.length || !missingMods.every((m) => remainingMods.find((r) => r.id === m.id))) {
          dispatch(setMissingMods({ missingMods: remainingMods }))
        }

        for (const mod of mods) {
          if (remainingMods.find((m) => m.id === mod.id)) continue
          const missingParents = getParents(mod.id, mods)
          if (missingParents.length > 0 && mod.enabled) await onModToggle(mod, false)
        }
      } catch {}
    }

    loadModFiles()
    const handleFocus = () => loadModFiles()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [modsPath, mods, onModToggle, missingMods, dispatch])

  const handlePresetOnce = useCallback(
    async (id: string) => {
      await dispatch<any>(applyPresetOnce(id))
    },
    [dispatch]
  )

  return (
    <div className="w-full z-10 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs w-full mr-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground pointer-events-none" />
          <Input
            placeholder="Поиск по названию мода"
            value={(table.getColumn('mod')?.getFilterValue() as string) ?? ''}
            onChange={(e) => table.getColumn('mod')?.setFilterValue(e.target.value)}
            className="pl-8"
          />
        </div>

        {presets.map((preset) => (
          <div key={preset.id}>
            <Tooltip delayDuration={400}>
              <TooltipTrigger>
                <Button
                  className="rounded-2xl"
                  key={preset.id}
                  size="sm"
                  variant={'outline'}
                  onClick={() => handlePresetOnce(preset.id)}
                  disabled={isApplyingPreset}
                >
                  <span className="outline-btn-text-gradient">
                    {preset.name}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{preset.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>

      <div className="rounded-sm border border-border/80 outline-btn-bg max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-border scrollbar-track-background">
        <Table className="rounded-sm">
          <TableHeader className='h-14'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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

export default React.memo(ModsTable)