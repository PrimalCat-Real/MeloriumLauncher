import React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Switch } from '../../../components/ui/switch';

type ModItem = {
  name: string;
  enabled: boolean;
};

const columns: ColumnDef<ModItem>[] = [
  {
    id: "info",
    header: () => null,
    cell: ({ row }) => (
      <div className="py-2 opacity-80">
        <div className="font-semibold">{row.original.name}</div>
        <div className="text-sm text-muted-foreground">
        </div>
      </div>
    ),
    filterFn: (row, id, value) => {
      if (!value) return true;
      const searchTerms = value.toLowerCase().split(/\s+/).filter(Boolean);
      const rowText = `${row.original.name.toLowerCase()}`;
      return searchTerms.every((term: string) => rowText.includes(term));
    },
  },
  {
    id: "actions",
    header: () => null,
    cell: ({ row }) => {
      const [enabled, setEnabled] = React.useState(row.original.enabled);

      const toggle = async () => {
        const newValue = !enabled;
      
        try {
          await window.launcherAPI.mods.toggleMod(row.original.name, newValue);
          setEnabled(newValue); // Только если операция удалась
        } catch (error) {
          console.error("Не удалось изменить статус мода:", error);
        }
      };
      

      return (
        <Switch checked={enabled} onCheckedChange={toggle} />
      );
    },
  },
];

export function MinimalTable() {
  const [mods, setMods] = React.useState<ModItem[]>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  React.useEffect(() => {
    const loadMods = async () => {
      const data = await window.launcherAPI.mods.getMods();
      const sortedData = data.sort((a: { name: string; }, b: { name: any; }) => a.name.localeCompare(b.name));
      setMods(sortedData);
    };
    loadMods();
  }, []);

  const table = useReactTable({
    data: mods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
    },
  });

  return (
    <div className="w-full">
      <div className="py-4">
        <Input
          placeholder="Поиск..."
          value={(table.getColumn("info")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("info")?.setFilterValue(event.target.value)
          }
          className="max-w-sm text-start bg-accent border-transparent font-sans"
        />
      </div>
      <div className="space-y-2 max-h-[75vh] overflow-auto">
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between px-4 py-1 rounded-xl bg-accent"
          >
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id} className={cell.column.id === 'info' ? 'flex-1' : ''}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const ModList = () => {
  return (
    <div className="flex flex-col p-4">
      <MinimalTable />
    </div>
  );
};

export default ModList;
