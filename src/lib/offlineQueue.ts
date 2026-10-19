/**
 * Antrean absensi offline (IndexedDB).
 * Menyimpan record absensi yang dipindai saat tidak ada koneksi, lalu
 * disinkronkan saat koneksi kembali.
 */
const DB_NAME = 'wcc-offline'
const STORE = 'attendance-queue'

interface QueuedRecord {
  id: string
  sessionId: string
  userId: string
  token: string
  scannedAt: string
  synced: boolean
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueueAttendance(record: Omit<QueuedRecord, 'id' | 'synced'>): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const item: QueuedRecord = { ...record, id: `${record.sessionId}-${record.userId}-${Date.now()}`, synced: false }
  store.put(item)
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

export async function pendingCount(): Promise<number> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const req = store.getAll()
  const rows = await new Promise<QueuedRecord[]>((res, rej) => {
    req.onsuccess = () => res(req.result as QueuedRecord[])
    req.onerror = () => rej(req.error)
  })
  db.close()
  return rows.filter((r) => !r.synced).length
}

export async function getPending(): Promise<QueuedRecord[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  const req = store.getAll()
  const rows = await new Promise<QueuedRecord[]>((res, rej) => {
    req.onsuccess = () => res(req.result as QueuedRecord[])
    req.onerror = () => rej(req.error)
  })
  db.close()
  return rows.filter((r) => !r.synced)
}

export async function markSynced(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const req = store.get(id)
  const row = await new Promise<QueuedRecord | undefined>((res, rej) => {
    req.onsuccess = () => res(req.result as QueuedRecord | undefined)
    req.onerror = () => rej(req.error)
  })
  if (row) {
    row.synced = true
    store.put(row)
  }
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}
