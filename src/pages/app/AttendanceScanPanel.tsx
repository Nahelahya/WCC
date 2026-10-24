import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { attendanceApi, sessionApi, userApi } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAsync } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { formatDateID } from '@/lib/date'
import { sessionStatus, canCheckIn } from '@/lib/session'
import { enqueueAttendance, getPending, markSynced, pendingCount } from '@/lib/offlineQueue'
import type { User } from '@/types'

type ScanResult = {
  kind: 'success' | 'already' | 'not_found' | 'session_inactive' | 'error'
  message: string
  user?: User
  at: string
}

export function AttendanceScanPanel() {
  const { toast } = useToast()
  const sessions = useAsync(() => sessionApi.list(), [])
  const members = useAsync(() => userApi.list(), [])

  const [sessionId, setSessionId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [manualQuery, setManualQuery] = useState('')
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [zoom, setZoom] = useState(1.6)
  const [pendingSync, setPendingSync] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null)

  const refreshPending = useCallback(async () => {
    try {
      setPendingSync(await pendingCount())
    } catch {
      /* ignore */
    }
  }, [])

  const syncPending = useCallback(async () => {
    if (!navigator.onLine) return
    const pending = await getPending()
    for (const rec of pending) {
      try {
        await attendanceApi.checkIn(rec.sessionId, rec.userId)
        await markSynced(rec.id)
      } catch {
        /* biarkan untuk retry nanti */
      }
    }
    await refreshPending()
  }, [refreshPending])

  useEffect(() => {
    if (!sessionId && sessions.data && sessions.data.length) {
      const today = new Date().toISOString().slice(0, 10)
      const upcoming = sessions.data.filter((s) => {
        const st = sessionStatus(s)
        return st === 'akan-datang' || st === 'berlangsung'
      })
      const todaySession = upcoming.find((s) => s.date === today)
      const pick = todaySession ?? upcoming[0] ?? sessions.data[0]
      setSessionId(pick.id)
    }
  }, [sessions.data, sessionId])

  useEffect(() => {
    const on = () => {
      setOnline(true)
      void syncPending()
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    void refreshPending()
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [syncPending, refreshPending])

  const selectedSession = sessions.data?.find((s) => s.id === sessionId)

  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.15
      osc.start()
      setTimeout(() => {
        osc.stop()
        ctx.close()
      }, 120)
    } catch {
      /* perangkat tidak mendukung audio */
    }
  }, [])

  const handleToken = useCallback(
    async (token: string) => {
      if (!sessionId) {
        toast('Pilih sesi latihan terlebih dahulu.', 'warning')
        return
      }
      const now = Date.now()
      if (lastTokenRef.current && lastTokenRef.current.token === token && now - lastTokenRef.current.at < 3000) {
        return
      }
      lastTokenRef.current = { token, at: now }

      let userFound: User | undefined
      try {
        userFound = await userApi.resolveAttendanceToken(token)
      } catch {
        setLastResult({ kind: 'not_found', message: 'Anggota Tidak Ditemukan', at: new Date().toISOString() })
        return
      }

      if (selectedSession) {
        const gate = canCheckIn(selectedSession)
        if (!gate.ok) {
          setLastResult({ kind: 'session_inactive', message: gate.reason ?? 'Sesi Tidak Aktif', user: userFound, at: new Date().toISOString() })
          return
        }
      }

      try {
        if (!navigator.onLine) {
          await enqueueAttendance({ sessionId, userId: userFound.id, token, scannedAt: new Date().toISOString() })
          setLastResult({ kind: 'success', message: 'Disimpan offline (belum tersinkron)', user: userFound, at: new Date().toISOString() })
          await refreshPending()
          return
        }
        await attendanceApi.checkIn(sessionId, userFound.id)
        setLastResult({ kind: 'success', message: 'Berhasil Absen', user: userFound, at: new Date().toISOString() })
        playBeep()
      } catch (err: any) {
        const status = err?.status
        const msg = err?.message ?? 'Terjadi kesalahan.'
        if (status === 409) {
          setLastResult({ kind: 'already', message: 'Sudah Absen', user: userFound, at: new Date().toISOString() })
        } else if (status === 400) {
          setLastResult({ kind: 'session_inactive', message: msg || 'Sesi Tidak Aktif', user: userFound, at: new Date().toISOString() })
        } else {
          setLastResult({ kind: 'error', message: msg, user: userFound, at: new Date().toISOString() })
        }
      }
    },
    [sessionId, selectedSession, playBeep, toast, refreshPending],
  )

  const startScan = async () => {
    setCameraError(null)
    if (!videoRef.current) return
    try {
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result) => {
          if (result) {
            handleToken(result.getText())
          }
        },
      )
      controlsRef.current = controls
      setScanning(true)
      // Coba zoom native (auto-zoom) jika perangkat mendukung.
      try {
        const video = videoRef.current
        const stream = video?.srcObject as MediaStream | null
        const track = stream && typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks()[0] : null
        const caps = track && typeof track.getCapabilities === 'function' ? (track.getCapabilities() as any) : null
        if (caps && caps.zoom) {
          const z = Math.min(Math.max(zoom, caps.zoom.min ?? 1), caps.zoom.max ?? zoom)
          await (track as any).applyConstraints({ zoom: z }).catch(() => {})
        }
      } catch {
        /* perangkat tidak mendukung zoom native; pakai zoom digital */
      }
    } catch (err: any) {
      setCameraError(err?.message ?? 'Kamera tidak dapat diakses.')
      setScanning(false)
    }
  }

  const stopScan = () => {
    try {
      controlsRef.current?.stop()
    } catch {
      /* ignore */
    }
    controlsRef.current = null
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const filteredMembers = (members.data ?? []).filter((m) => {
    const q = manualQuery.trim().toLowerCase()
    if (!q) return false
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || (m.phone ?? '').includes(q)
  })

  const resultTone =
    lastResult?.kind === 'success'
      ? 'success'
      : lastResult?.kind === 'already'
        ? 'warning'
        : lastResult?.kind === 'not_found'
          ? 'danger'
          : 'info'

  return (
    <>
      <PageHeader
        title="Scan Absensi QR"
        description="Pindai QR Code pada ID card anggota untuk mencatat kehadiran."
        action={
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${online ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-success' : 'bg-warning'}`} />
            {online ? 'Online' : 'Offline'}
            {pendingSync > 0 ? ` · ${pendingSync} belum tersinkron` : ''}
          </span>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select label="Sesi latihan" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">Pilih sesi...</option>
          {(sessions.data ?? [])
            .filter((s) => {
              const st = sessionStatus(s)
              return st === 'akan-datang' || st === 'berlangsung'
            })
            .map((s) => (
            <option key={s.id} value={s.id}>
              {formatDateID(s.date)} — {s.title} ({s.startTime}-{s.endTime})
            </option>
          ))}
        </Select>
        {selectedSession && (
          <div className="flex items-end">
            <StatusBadge tone={selectedSession.cancelled ? 'danger' : 'info'}>
              {sessionStatus(selectedSession) === 'berlangsung' ? 'Sedang berlangsung' : sessionStatus(selectedSession)}
            </StatusBadge>
          </div>
        )}
      </div>

      {sessions.loading ? (
        <CardSkeleton lines={3} />
      ) : sessions.error ? (
        <div className="card"><ErrorState message={sessions.error} onRetry={sessions.reload} /></div>
      ) : (sessions.data ?? []).filter((s) => {
          const st = sessionStatus(s)
          return st === 'akan-datang' || st === 'berlangsung'
        }).length === 0 ? (
        <div className="card"><EmptyState icon="calendar" title="Tidak ada sesi latihan yang akan datang." /></div>
      ) : (
        <>
          <div className="card mb-4 overflow-hidden">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }} playsInline muted />
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                  <p className="text-sm">Kamera belum aktif</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 p-3">
              <label className="text-[12.5px] text-muted">Zoom: {zoom.toFixed(1)}x</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-40"
              />
              {!scanning ? (
                <Button icon="camera" onClick={startScan} disabled={!sessionId}>
                  Mulai Scan
                </Button>
              ) : (
                <Button variant="danger" icon="x" onClick={stopScan}>
                  Berhenti Scan
                </Button>
              )}
            </div>
            {cameraError && <p className="px-3 pb-3 text-sm text-danger">{cameraError}</p>}
          </div>

          {lastResult && (
            <div className="card mb-4 p-4">
              <div className="flex items-start gap-3">
                {lastResult.user?.photoUrl ? (
                  <img src={lastResult.user.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon name="user" size={20} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{lastResult.user?.name ?? '—'}</p>
                  <p className="text-[12.5px] text-muted">{lastResult.user?.id ?? ''}</p>
                  <div className="mt-1.5">
                    <StatusBadge tone={resultTone as any}>{lastResult.message}</StatusBadge>
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted">{new Date(lastResult.at).toLocaleTimeString('id-ID')}</p>
                </div>
              </div>
            </div>
          )}

          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold text-ink">Input manual (QR rusak)</p>
            <Input
              label="Cari nama / nomor anggota"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Ketik nama atau ID anggota..."
            />
            {manualQuery.trim() && (
              <ul className="mt-3 divide-y divide-line">
                {filteredMembers.slice(0, 8).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                      <p className="text-[12px] text-muted">{m.id}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!sessionId) { toast('Pilih sesi terlebih dahulu.', 'warning'); return }
                        try {
                          if (!navigator.onLine) {
                            await enqueueAttendance({ sessionId, userId: m.id, token: m.attendanceToken ?? '', scannedAt: new Date().toISOString() })
                            setLastResult({ kind: 'success', message: 'Disimpan offline (belum tersinkron)', user: m, at: new Date().toISOString() })
                            await refreshPending()
                            return
                          }
                          await attendanceApi.checkIn(sessionId, m.id)
                          setLastResult({ kind: 'success', message: 'Berhasil Absen', user: m, at: new Date().toISOString() })
                          playBeep()
                        } catch (err: any) {
                          if (err?.status === 409) {
                            setLastResult({ kind: 'already', message: 'Sudah Absen', user: m, at: new Date().toISOString() })
                          } else {
                            setLastResult({ kind: 'error', message: err?.message ?? 'Gagal', user: m, at: new Date().toISOString() })
                          }
                        }
                      }}
                    >
                      Catat Hadir
                    </Button>
                  </li>
                ))}
                {filteredMembers.length === 0 && <li className="py-2 text-sm text-muted">Tidak ditemukan.</li>}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  )
}
