import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { LandingPage } from '@/pages/public/LandingPage'
import { PrivacyPolicyPage } from '@/pages/public/PrivacyPolicyPage'
import { HowToJoinPage, PublicCoachesPage } from '@/pages/public/PublicCoachesPage'
import { ForgotPasswordPage, LoginPage } from '@/pages/public/LoginPage'
import { ResetPasswordPage } from '@/pages/public/ResetPasswordPage'
import { RegisterPage, RegisterStatusPage } from '@/pages/public/RegisterPage'
import { DashboardPage } from '@/pages/app/DashboardPage'
import { SchedulePage } from '@/pages/app/SchedulePage'
import { SessionDetailPage } from '@/pages/app/SessionDetailPage'
import { AttendancePage } from '@/pages/app/AttendancePage'
import { AnnouncementDetailPage, AnnouncementsPage } from '@/pages/app/AnnouncementsPage'
import { ProfilePage } from '@/pages/app/ProfilePage'
import { CoachAdminPage } from '@/pages/app/admin/CoachAdminPage'
import { RegistrationsPage } from '@/pages/app/admin/RegistrationsPage'
import { TreasuryPage } from '@/pages/app/admin/TreasuryPage'
import { ReportsPage } from '@/pages/app/admin/ReportsPage'
import { SyncPage } from '@/pages/app/admin/SyncPage'
import { AuditLogPage } from '@/pages/app/admin/AuditLogPage'
import { LandingSettingsPage } from '@/pages/app/admin/LandingSettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      {/* Halaman publik */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/coach" element={<PublicCoachesPage />} />
        <Route path="/cara-bergabung" element={<HowToJoinPage />} />
        <Route path="/daftar" element={<RegisterPage />} />
        <Route path="/daftar/status" element={<RegisterStatusPage />} />
        <Route path="/kebijakan-privasi" element={<PrivacyPolicyPage />} />
      </Route>

      {/* Autentikasi */}
      <Route path="/masuk" element={<LoginPage />} />
      <Route path="/lupa-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Area aplikasi (perlu login, menu mengikuti peran) */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="jadwal" element={<SchedulePage />} />
        <Route path="jadwal/:id" element={<SessionDetailPage />} />
        <Route path="absensi" element={<AttendancePage />} />
        <Route path="pengumuman" element={<AnnouncementsPage />} />
        <Route path="pengumuman/:id" element={<AnnouncementDetailPage />} />
        <Route path="coach" element={<CoachAdminPage />} />
        <Route path="pendaftaran" element={<RegistrationsPage />} />
        <Route path="kas" element={<TreasuryPage />} />
        <Route path="laporan" element={<ReportsPage />} />
        <Route path="sinkronisasi" element={<SyncPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="landing" element={<LandingSettingsPage />} />
        <Route path="profil" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
