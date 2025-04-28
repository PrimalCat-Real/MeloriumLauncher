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
import RamSelector from '../../components/RamSelector';


const modDependencies: Record<string, string[]> = {
    "litematica-fabric-1.21.4-0.21.2.jar": ["malilib-fabric-1.21.4-0.23.2.jar"],
    "fallingleaves-1.17.0+1.21.4.jar": ["cloth-config-17.0.144-fabric.jar"],
    "sodium-extra-fabric-0.6.1+mc1.21.4.jar": ["sodium-fabric-0.6.13+mc1.21.4.jar"],
    "sodiumdynamiclights-fabric-1.0.10-1.21.4.jar": ["sodium-fabric-0.6.13+mc1.21.4.jar"],
    "iris-fabric-1.8.8+mc1.21.4.jar": ["sodium-fabric-0.6.13+mc1.21.4.jar"],
    "XaerosWorldMap_1.39.4_Fabric_1.21.4.jar": ["Xaeros_Minimap_25.2.0_Fabric_1.21.4.jar"],
    "emotecraft-flashback-addon-1.0+mc1.21.1.jar": ["emotecraft-fabric-for-MC1.21.4-2.5.6.jar", "Flashback-0.31.0-for-MC1.21.4.jar", "fabric-language-kotlin-1.13.2+kotlin.2.1.20.jar"],
    "AmbientSounds_FABRIC_v6.1.3_mc1.21.4.jar": ["CreativeCore_FABRIC_v2.12.35_mc1.21.4.jar"],
    "Flashback-0.31.0-for-MC1.21.4.jar": ["fabric-language-kotlin-1.13.2+kotlin.2.1.20.jar"],
};

type ModItem = {
  name: string;
  enabled: boolean;
};

const createColumns = (
  mods: ModItem[], 
  setMods: React.Dispatch<React.SetStateAction<ModItem[]>>, 
  toggleModAPI: (name: string, enabled: boolean) => Promise<void> 
): ColumnDef<ModItem>[] => [
  {
    id: "info",
    header: () => null,
    cell: ({ row }) => (
      <div className="py-2 opacity-80">
        <div className="font-semibold">{row.original.name}</div>
        <div className="text-sm text-muted-foreground">
          {modDependencies[row.original.name]?.length > 0 && (
            <span>Зависимости: {modDependencies[row.original.name].join(', ')}</span>
          )}
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
      const modName = row.original.name;
      const enabled = row.original.enabled;

      const toggle = async () => {
        const newValue = !enabled;

        try {
          const modsToToggle: { name: string; enabled: boolean }[] = [];
          modsToToggle.push({ name: modName, enabled: newValue });

          if (newValue) {
            const dependencies = modDependencies[modName] || [];
            dependencies.forEach(dep => {
              const depMod = mods.find(m => m.name === dep);
              if (depMod && !depMod.enabled) {
                modsToToggle.push({ name: dep, enabled: true });
              }
            });
          } else {
            const dependencies = modDependencies[modName] || [];
             dependencies.forEach(dep => {
                const isDependencyRequiredByOtherEnabledMods = mods.some(otherMod =>
                    otherMod.enabled && 
                    otherMod.name !== modName && 
                    (modDependencies[otherMod.name] || []).includes(dep)
                );

                if (!isDependencyRequiredByOtherEnabledMods) {
                    const depMod = mods.find(m => m.name === dep);
                     if(depMod && depMod.enabled){
                         modsToToggle.push({ name: dep, enabled: false });
                     }
                }
             });
          }

          for (const modToToggle of modsToToggle) {
             await toggleModAPI(modToToggle.name, modToToggle.enabled);
          }

          setMods(prevMods =>
            prevMods.map(mod => {
              const toggled = modsToToggle.find(m => m.name === mod.name);
              return toggled ? { ...mod, enabled: toggled.enabled } : mod;
            })
          );

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

  const columns = React.useMemo(() =>
     createColumns(mods, setMods, window.launcherAPI.mods.toggleMod),
  [mods, setMods]); 


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
      
      <div className="py-4 flex w-full gap-10">
        
        <Input
          placeholder="Поиск..."
          value={(table.getColumn("info")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("info")?.setFilterValue(event.target.value)
          }
          className="max-w-sm text-start bg-accent border-transparent font-sans"
        />
        <RamSelector></RamSelector>
        
      </div>
      <div className="space-y-2 max-h-[73vh] overflow-auto">
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