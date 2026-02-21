export function CsvTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            {rows[0].map((cell, i) => (
              <th
                key={i}
                className="border-b border-r px-2 py-1.5 text-left font-medium whitespace-nowrap"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri} className="border-t hover:bg-muted/30">
              {row.map((cell, ci) => (
                <td key={ci} className="border-r px-2 py-1 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
