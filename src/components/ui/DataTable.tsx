import type { ReactNode } from 'react'
import { cn } from '@/lib/session'
import { EmptyState, ErrorState, TableSkeleton } from './Feedback'
import { Icon, type IconName } from './Icon'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
  headerClassName?: string
  align?: 'left' | 'right' | 'center'
  /** Sembunyikan kolom ini pada layar kecil (tabel tetap bisa digeser). */
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: IconName
  emptyAction?: ReactNode
  /** Kartu ringkas untuk mobile; jika diberikan, tabel diganti card di layar kecil. */
  renderMobileCard?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
  caption?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = 'Belum ada data',
  emptyDescription,
  emptyIcon = 'inbox',
  emptyAction,
  renderMobileCard,
  onRowClick,
  caption,
}: DataTableProps<T>) {
  if (loading) return <TableSkeleton cols={Math.min(columns.length, 6)} />
  if (error) return <div className="card"><ErrorState message={error} onRetry={onRetry} /></div>
  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {renderMobileCard ? (
        <>
          <ul className="divide-y divide-line sm:hidden">
            {rows.map((row) => (
              <li key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {renderMobileCard(row)}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <TableBody columns={columns} rows={rows} rowKey={rowKey} onRowClick={onRowClick} caption={caption} />
          </div>
        </>
      ) : (
        <div className="overflow-x-auto">
          <TableBody columns={columns} rows={rows} rowKey={rowKey} onRowClick={onRowClick} caption={caption} forceTable />
        </div>
      )}
    </div>
  )
}

function TableBody<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  caption,
  forceTable,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  caption?: string
  forceTable?: boolean
}) {
  return (
    <table className={cn('data-table', forceTable && 'min-w-[640px]')}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(
                c.align === 'right' && 'text-right',
                c.align === 'center' && 'text-center',
                c.hideOnMobile && 'hidden md:table-cell',
                c.headerClassName,
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(onRowClick && 'cursor-pointer')}
          >
            {columns.map((c) => (
              <td
                key={c.key}
                className={cn(
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  c.hideOnMobile && 'hidden md:table-cell',
                  c.className,
                )}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface PaginationProps {
  page: number
  pageCount: number
  total: number
  perPage: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageCount, total, perPage, onChange }: PaginationProps) {
  if (pageCount <= 1) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-4" aria-label="Navigasi halaman">
      <p className="text-[13px] text-muted">
        Menampilkan <span className="font-medium text-ink">{from}</span>–
        <span className="font-medium text-ink">{to}</span> dari{' '}
        <span className="font-medium text-ink">{total}</span> data
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex h-10 w-10 items-center justify-center rounded-control border border-line bg-surface text-ink transition-colors hover:bg-bg disabled:opacity-45"
          aria-label="Halaman sebelumnya"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span className="min-w-[74px] text-center text-[13px] font-medium text-muted">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          className="flex h-10 w-10 items-center justify-center rounded-control border border-line bg-surface text-ink transition-colors hover:bg-bg disabled:opacity-45"
          aria-label="Halaman berikutnya"
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
    </nav>
  )
}
