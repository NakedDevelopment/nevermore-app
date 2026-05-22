import React from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  className?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  const getCellValue = (row: T, column: Column<T>) => {
    if (column.render) {
      return column.render(row[column.key as keyof T], row);
    }
    return row[column.key as keyof T] || '';
  };

  return (
    <div className={`-mx-1 overflow-x-auto sm:mx-0 ${className}`}>
      <table className="w-full min-w-[520px]" style={{ borderSpacing: '0 0', borderCollapse: 'separate' }}>
        <thead>
          <tr className="border-b-2 border-[#965cdf]">
            {columns.map((column, index) => (
              <th
                key={String(column.key)}
                className={`text-left py-3 font-medium text-[14px] text-[#8f8f8f] leading-[22px] sm:py-4 sm:text-[16px] sm:leading-[24px] ${
                  index === 0 ? 'pl-3 sm:pl-6' : 'px-3 sm:px-6'
                } ${index === columns.length - 1 ? 'pr-3 sm:pr-6' : ''}`}
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className={`min-h-[64px] sm:h-[80px] border-b border-[rgba(255,255,255,0.1)] ${
                rowIndex % 2 === 0 ? 'bg-[rgba(255,255,255,0.05)]' : ''
              } hover:bg-[rgba(255,255,255,0.08)] transition ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {columns.map((column, colIndex) => (
                <td
                  key={String(column.key)}
                  className={`text-white text-[13px] leading-[22px] sm:text-[14px] sm:leading-[24px] py-3 sm:py-0 ${
                    colIndex === 0 ? 'pl-3 sm:pl-6' : 'px-3 sm:px-6'
                  } ${colIndex === columns.length - 1 ? 'pr-3 sm:pr-6' : ''}`}
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                >
                  {getCellValue(row, column) as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

