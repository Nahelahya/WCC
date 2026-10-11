import { query } from '../db/pool'
import { newId } from './ids'

export type AuditAction = 'create' | 'update' | 'delete'

export interface AuditInput {
  /** Pelaku perubahan. `null` untuk aksi otomatis oleh sistem. */
  userId: string | null
  action: AuditAction
  entity: string
  entityId?: string | null
  detail?: Record<string, unknown> | null
}

/**
 * Menulis satu baris jejak audit sesuai PRD bagian 10 (Auditability):
 * "setiap perubahan transaksi kas tercatat dengan timestamp dan identitas
 * pengguna". Tabel `audit_logs` sudah ada pada migrasi 001; fungsi ini adalah
 * satu-satunya penulis resminya agar format entri konsisten.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  await query(
    `insert into audit_logs (id, user_id, action, entity, entity_id, detail)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      newId('al'),
      input.userId,
      input.action,
      input.entity,
      input.entityId ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
    ],
  )
}
