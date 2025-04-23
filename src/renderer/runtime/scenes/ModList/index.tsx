import React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  Row,
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
import { Button } from "../../../components/ui/button";
import { Switch } from '../../../components/ui/switch';

const testData = [
  {
    id: "1",
    name: "Мод 1",
    description: "Test",
  },
  {
    id: "2",
    name: "Мод 2",
    description: "описание мода",
  },
  {
    id: "3",
    name: "Мод 3",
    description: "Test",
  },
  {
    id: "4",
    name: "Мод 4",
    description: "описание мода",
  },
];

type Item = {
  id: string;
  name: string;
  description: string;
};

const columns: ColumnDef<Item>[] = [
  {
    id: "info",
    header: () => null,
    cell: ({ row }) => (
      <div className="py-2 opacity-80">
        <div className="font-semibold">{row.original.name}</div>
        <div className="text-sm text-muted-foreground">
          {row.original.description}
        </div>
      </div>
    ),
    filterFn: (row, id, value) => {
      if (!value) return true;
      
      const searchTerms = value.toLowerCase().split(/\s+/).filter(Boolean);
      const rowText = `${row.original.name.toLowerCase()} ${row.original.description.toLowerCase()}`;
      
      return searchTerms.every((term: string) => rowText.includes(term));
    },
  },
  {
    id: "actions",
    header: () => null,
    cell: () => (
      <div className="">
        <Switch />
      </div>
    ),
  },
];

export function MinimalTable() {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const table = useReactTable({
    data: testData,
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
          className="max-w-sm text-start bg-accent border-transparent"
        />
      </div>
      <div className="space-y-2">
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