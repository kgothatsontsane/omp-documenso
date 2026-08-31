import { Trans, useLingui } from '@lingui/react/macro';
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  Table as TTable,
  Updater,
  VisibilityState,
} from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type React from 'react';
import { useMemo } from 'react';

import { cn } from '../lib/utils';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

// Per-column styling hooks for the DataTable (e.g. sticky action columns).
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}

export type DataTableChildren<TData> = (_table: TTable<TData>) => React.ReactNode;

export type { ColumnDef as DataTableColumnDef, RowSelectionState } from '@tanstack/react-table';

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  columnVisibility?: VisibilityState;
  data: TData[];
  onRowClick?: (row: TData) => void;
  rowClassName?: string;
  perPage?: number;
  currentPage?: number;
  totalPages?: number;
  onPaginationChange?: (_page: number, _perPage: number) => void;
  onClearFilters?: () => void;
  emptyState?: React.ReactNode;
  hasFilters?: boolean;
  children?: DataTableChildren<TData>;
  skeleton?: {
    enable: boolean;
    rows: number;
    component?: React.ReactNode;
  };
  error?: {
    enable: boolean;
    component?: React.ReactNode;
  };
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  getRowId?: (row: TData) => string;
  /**
   * Class applied to the underlying <table> element. Pass `table-fixed` (with
   * explicit column `size`s) to make the table always fit its container instead
   * of overflowing into horizontal scroll.
   */
  tableClassName?: string;
  /**
   * Enables drag-to-resize handles on the header cells. Column widths are held
   * in table state (not persisted).
   */
  enableColumnResize?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  columnVisibility,
  data,
  error,
  perPage,
  currentPage,
  totalPages,
  skeleton,
  hasFilters,
  onClearFilters,
  onPaginationChange,
  onRowClick,
  rowClassName,
  children,
  emptyState,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  tableClassName,
  enableColumnResize,
}: DataTableProps<TData, TValue>) {
  const { t } = useLingui();
  const pagination = useMemo<PaginationState>(() => {
    if (currentPage !== undefined && perPage !== undefined) {
      return {
        pageIndex: currentPage - 1,
        pageSize: perPage,
      };
    }

    return {
      pageIndex: 0,
      pageSize: 0,
    };
  }, [currentPage, perPage]);

  const manualPagination = Boolean(currentPage !== undefined && totalPages !== undefined);

  const onTablePaginationChange = (updater: Updater<PaginationState>) => {
    if (typeof updater === 'function') {
      const newState = updater(pagination);

      onPaginationChange?.(newState.pageIndex + 1, newState.pageSize);
    } else {
      onPaginationChange?.(updater.pageIndex + 1, updater.pageSize);
    }
  };

  const onTableRowSelectionChange = (updater: Updater<RowSelectionState>) => {
    if (onRowSelectionChange) {
      const newSelection = typeof updater === 'function' ? updater(rowSelection ?? {}) : updater;
      onRowSelectionChange(newSelection);
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: enableColumnResize ?? false,
    state: {
      pagination: manualPagination ? pagination : undefined,
      columnVisibility,
      rowSelection: rowSelection ?? {},
    },
    manualPagination,
    pageCount: totalPages,
    onPaginationChange: onTablePaginationChange,
    enableRowSelection,
    onRowSelectionChange: onTableRowSelectionChange,
    getRowId,
  });

  return (
    <>
      <div className="rounded-md border">
        <Table className={tableClassName}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn('relative', header.column.columnDef.meta?.headerClassName)}
                      style={{ width: `${header.column.getSize()}px` }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}

                      {enableColumnResize && header.column.getCanResize() && (
                        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          title={t`Drag to resize, double-click to reset`}
                          className={cn(
                            'absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none',
                            'after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border',
                            'hover:after:w-0.5 hover:after:bg-primary/50',
                            header.column.getIsResizing() && 'after:bg-primary',
                          )}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={rowClassName}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.cellClassName}
                      style={{
                        width: `${cell.column.getSize()}px`,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error?.enable ? (
              <TableRow>
                {error.component ?? (
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <Trans>Something went wrong.</Trans>
                  </TableCell>
                )}
              </TableRow>
            ) : skeleton?.enable ? (
              Array.from({ length: skeleton.rows }).map((_, i) => (
                <TableRow key={`skeleton-row-${i}`}>{skeleton.component ?? <Skeleton />}</TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  {emptyState ?? (
                    <>
                      <p>
                        <Trans>No results found</Trans>
                      </p>

                      {hasFilters && onClearFilters !== undefined && (
                        <button onClick={() => onClearFilters()} className="mt-1 text-foreground text-sm">
                          <Trans>Clear filters</Trans>
                        </button>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {children && <div className="mt-8 w-full">{children(table)}</div>}
    </>
  );
}
