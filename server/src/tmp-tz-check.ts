import { mapAttendanceDecorated } from './lib/mappers'
import { clockTime, currentMonth, formatDateTimeID, localDateOf, timeOf, todayISO } from './lib/date'

const now = new Date()
console.log('now(UTC) =', now.toISOString())
console.log('server clockTime =', clockTime(now))
console.log('frontend todayISO =', todayISO())
console.log('frontend currentMonth =', currentMonth())
console.log('localDateOf(now) =', localDateOf(now.toISOString()))
console.log('timeOf(now) =', timeOf(now.toISOString()))
console.log('formatDateTimeID(now) =', formatDateTimeID(now.toISOString()))

const row = mapAttendanceDecorated({
  id: 'a1',
  session_id: 's1',
  user_id: 'u1',
  check_in_at: now,
  status: 'hadir',
  created_at: now,
  user_name: 'U',
  session_title: 'S',
  session_date: todayISO(),
  session_start_time: '19:00',
  session_end_time: '21:00',
  session_location: 'X',
  session_coach_name: 'C',
  session_cancelled: false,
  photo_url: null,
} as never)
console.log('checkInTime =', row.checkInAt)
