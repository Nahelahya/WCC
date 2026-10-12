import type { SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'grid'
  | 'calendar'
  | 'calendar-plus'
  | 'check'
  | 'check-circle'
  | 'megaphone'
  | 'user'
  | 'users'
  | 'wallet'
  | 'chart'
  | 'refresh'
  | 'file-text'
  | 'search'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'x'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-left'
  | 'logout'
  | 'menu'
  | 'eye'
  | 'eye-off'
  | 'alert'
  | 'info'
  | 'clock'
  | 'pin'
  | 'download'
  | 'arrow-right'
  | 'shield'
  | 'lock'
  | 'mail'
  | 'phone'
  | 'image'
  | 'mountain'
  | 'settings'
  | 'list'
  | 'inbox'
  | 'camera'
  | 'upload'
  | 'save'
  | 'undo'
  | 'chevron-up'
  | 'sun'
  | 'moon'

const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  calendar: 'M7 3v3M17 3v3M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5z',
  'calendar-plus': 'M7 3v3M17 3v3M3.5 9.5h17M5 5.5h14A1.5 1.5 0 0 1 20.5 7v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5zM12 12.5v5M9.5 15h5',
  check: 'M4.5 12.5l5 5 10-11',
  'check-circle': 'M9 12.5l2 2 4-4.5M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  megaphone: 'M4 10.5v3l11 5V5.5l-11 5zM15 7.5a4 4 0 0 1 0 9M7 13v5.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.9-3.4 3.9-5.5 7.5-5.5s6.6 2.1 7.5 5.5',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3 3.3-4.8 6.5-4.8s5.7 1.8 6.5 4.8M16.5 4.6a3.5 3.5 0 0 1 0 6.8M18 15.5c2 .7 3.3 2.2 3.7 4.5',
  wallet: 'M3.5 7.5h15A1.5 1.5 0 0 1 20 9v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6A1.5 1.5 0 0 1 5.5 4.5h10M16 13h1.5',
  chart: 'M4.5 20V4.5M4.5 20h15M8.5 20v-6M12.5 20V9M16.5 20v-3.5',
  'file-text': 'M6 3.5h8L19 8.5v12H6zM14 3.5V9h5M9 13h7M9 16.5h5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.2 16.2 21 21',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14.5 5.5l4 4',
  x: 'M6 6l12 12M18 6 6 18',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-down': 'M5 9l7 7 7-7',
  'chevron-left': 'M15 5l-7 7 7 7',
  logout: 'M15 5.5H18A1.5 1.5 0 0 1 19.5 7v10a1.5 1.5 0 0 1-1.5 1.5h-3M11 8l-4 4 4 4M7 12h9',
  menu: 'M4 7h16M4 12h16M4 17h16',
  eye: 'M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M4 4l16 16M9.5 5.5A9.6 9.6 0 0 1 12 5.2c6 0 9.5 6.8 9.5 6.8a17 17 0 0 1-2.9 3.7M6.3 7.5A17 17 0 0 0 2.5 12S6 18.8 12 18.8c.9 0 1.7-.1 2.5-.4M10 10a2.8 2.8 0 0 0 4 4',
  alert: 'M12 8.5v5M12 17h.01M10.3 3.9 2.6 17.2A1.8 1.8 0 0 0 4.2 20h15.6a1.8 1.8 0 0 0 1.6-2.8L13.7 3.9a1.8 1.8 0 0 0-3.4 0z',
  info: 'M12 11v6M12 7.5h.01M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  clock: 'M12 7.5V12l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  pin: 'M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  download: 'M12 4v11M7.5 11 12 15.5 16.5 11M4.5 19.5h15',
  'arrow-right': 'M4 12h15M13 6l6 6-6 6',
  shield: 'M12 3.5 5 6v6c0 4 3 7.5 7 8.5 4-1 7-4.5 7-8.5V6l-7-2.5zM9 12l2 2 4-4.5',
  lock: 'M6 11V8.5a6 6 0 0 1 12 0V11M5.5 11h13v9.5h-13zM12 15v2.5',
  mail: 'M3.5 6.5h17v11h-17zM4 7l8 6 8-6',
  phone: 'M7 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16.5 12l4 1.5v3A2 2 0 0 1 18.4 18.5C11 17.5 6 12.5 5 5.1A2 2 0 0 1 7 3.5z',
  image: 'M4 5.5h16v13H4zM4 15l4.5-4.5 4 4 3-3L20 15M15.5 9.5h.01',
  camera: 'M4 7.5h3l1.5-2.5h7L17 7.5h3A1.5 1.5 0 0 1 20 9v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V9a1.5 1.5 0 0 1 1.5-1.5zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  upload: 'M12 16V4.5m0 0L8.5 8M12 4.5l3.5 3.5M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2',
  save: 'M6 3.5h9L19 7.5v12A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3h-.5zm3 12h6M9 9.5h6',
  refresh: 'M20.5 12a8.5 8.5 0 1 1-2.5-6M20.5 7.5v-4h-4',
  undo: 'M7.5 9.5H16A4.5 4.5 0 1 1 16 18.5H9.5M7.5 9.5L11 6M7.5 9.5L11 13',
  plus: 'M12 5v14M5 12h14',
  trash: 'M6.5 7.5v10A1.5 1.5 0 0 0 8 19h8a1.5 1.5 0 0 0 1.5-1.5v-10M4.5 7.5h15M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M9.5 10.5v6M14.5 10.5v6',
  'chevron-up': 'M5 15l7-7 7 7',
  mountain: 'M3 19.5h18L14 6l-3.5 6-2.5-3.5L3 19.5z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 14.5a7.9 7.9 0 0 0 0-5l1.7-1.3-1.9-3.3-2 .8a7.8 7.8 0 0 0-4.3-2.5L12.5 1h-3.8L8.3 3.2A7.8 7.8 0 0 0 4 5.7l-2-.8L.1 8.2l1.7 1.3a7.9 7.9 0 0 0 0 5L.1 15.8l1.9 3.3 2-.8a7.8 7.8 0 0 0 4.3 2.5l.4 2.2h3.8l.4-2.2a7.8 7.8 0 0 0 4.3-2.5l2 .8 1.9-3.3-1.7-1.3z',
  list: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01',
  inbox: 'M3.5 13.5 6 5.5h12l2.5 8v5.5h-17zM3.5 13.5H9a3 3 0 0 0 6 0h5.5',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M20.6 14.4A8.6 8.6 0 0 1 9.6 3.4a8.6 8.6 0 1 0 11 11z',
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
