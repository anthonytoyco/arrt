"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

interface CSVDataTableProps {
  headers: string[];
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}

export function CSVDataTable({ headers, rows, onChange }: CSVDataTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  function updateCell(rowIdx: number, col: string, value: string) {
    onChange(rows.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r)));
  }

  function deleteRow(rowIdx: number) {
    onChange(rows.filter((_, i) => i !== rowIdx));
  }

  function addRow() {
    onChange([...rows, Object.fromEntries(headers.map((h) => [h, ""]))]);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-10">#</th>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
              <th className="px-4 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">
                  No rows. Add one below.
                </td>
              </tr>
            )}
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="px-4 py-1.5 text-xs text-gray-400 select-none">{rowIdx + 1}</td>
                {headers.map((col) => (
                  <td key={col} className="px-2 py-1">
                    {editingCell?.row === rowIdx && editingCell?.col === col ? (
                      <Input
                        autoFocus
                        value={row[col] ?? ""}
                        onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
                        }}
                        className="h-7 text-sm py-0"
                      />
                    ) : (
                      <span
                        className="block px-2 py-1 rounded cursor-text hover:bg-gray-100 min-w-[60px] min-h-[28px]"
                        onClick={() => setEditingCell({ row: rowIdx, col })}
                      >
                        {row[col] || <span className="text-gray-300">—</span>}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={() => deleteRow(rowIdx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
        <Plus className="h-3.5 w-3.5" />
        Add row
      </Button>
    </div>
  );
}
