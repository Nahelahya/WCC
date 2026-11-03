import type { Role } from '@/types'

/**
 * Renderer kartu anggota WCC.
 *
 * Desain mengikuti template Canva "Gold and Black Modern VIP Member Card".
 * Seluruh angka di `LAYOUT` diambil langsung dari layout Canva (ruang desain
 * 1600 x 1135) sehingga hasil canvas, PNG, dan PDF identik dengan desain:
 * posisi memakai titik kiri-atas kotak teks Canva, ukuran memakai font-size
 * efektif setelah transform elemen Canva.
 *
 * QR Code TIDAK dibuat ulang di sini: komponen memakai data URL QR yang sudah
 * dihasilkan alur absensi yang lama, lalu hanya menempatkannya di kartu.
 */

export const CARD_WIDTH = 1600
export const CARD_HEIGHT = 1135

const COLORS = {
  red: '#D12929',
  white: '#FFFFFF',
  website: '#CC4732',
} as const

const FONT = {
  display: 'Cinzel Decorative',
  heading: 'Anton',
  body: 'Nourd',
} as const

const ASSET = {
  background: '/member-card/background.jpg',
  ribbon: '/member-card/gold-ribbon.png',
  logo: '/member-card/arrow-logo.png',
  whatsapp: '/member-card/icons/whatsapp.svg',
  instagram: '/member-card/icons/instagram.svg',
  pin: '/member-card/icons/pin.svg',
} as const

export const ROLE_LABEL: Record<Role, string> = {
  anggota: 'Atlet',
  coach: 'Coach',
  pengurus: 'Pengurus',
}

/** Posisi & ukuran asli dari Canva, dalam ruang desain 1600 x 1135. */
const LAYOUT = {
  front: {
    heading: { x: 146.9, top: 242.3, size: 53.43 },
    title: { x: 146.9, top: 308.0, size: 115.02 },
    name: { x: 146.9, top: 445.7, size: 42.08, maxWidth: 711 },
    role: { x: 146.9, top: 511.7, size: 42.08, maxWidth: 711 },
    qr: { x: 146.9, y: 622.9, size: 267.4 },
  },
  back: {
    heading: { centerX: 765.3, top: 99.5, size: 76.33, maxWidth: 1150 },
    note: { x: 245.3, top: 219.2, size: 34.35 },
    phone: { x: 273.8, top: 349.9, size: 56.3 },
    instagram: { x: 273.8, top: 474.1, size: 68.67 },
    address: { centerX: 728.2, top: 656.6, size: 25.48, lineHeight: 33.93, maxWidth: 931 },
    website: { x: 17.4, top: 1041.1, size: 56.24 },
  },
} as const

export interface CardAssets {
  background: HTMLImageElement
  ribbon: HTMLImageElement
  logo: HTMLImageElement
  whatsapp: HTMLImageElement
  instagram: HTMLImageElement
  pin: HTMLImageElement
  qr: HTMLImageElement
}

export interface CardContent {
  name: string
  role: Role
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Gagal memuat aset kartu: ${src}`))
    img.src = src
  })
}

/** Muat semua aset + font sebelum menggambar supaya hasil ekspor konsisten. */
export async function loadCardAssets(qrDataUrl: string): Promise<CardAssets> {
  const [background, ribbon, logo, whatsapp, instagram, pin, qr] = await Promise.all([
    loadImage(ASSET.background),
    loadImage(ASSET.ribbon),
    loadImage(ASSET.logo),
    loadImage(ASSET.whatsapp),
    loadImage(ASSET.instagram),
    loadImage(ASSET.pin),
    loadImage(qrDataUrl),
  ])

  if (typeof document !== 'undefined' && 'fonts' in document) {
    await Promise.all([
      document.fonts.load(`400 115px "${FONT.display}"`),
      document.fonts.load(`400 42px "${FONT.body}"`),
      document.fonts.load(`400 76px "${FONT.heading}"`),
    ])
    await document.fonts.ready
  }

  return { background, ribbon, logo, whatsapp, instagram, pin, qr }
}

function font(size: number, family: string): string {
  return `400 ${size}px "${family}"`
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function drawAt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(img, x, y, w, h)
}

/** Font metrics dipakai untuk menaruh baseline seperti kotak teks Canva. */
function ascentOf(ctx: CanvasRenderingContext2D, text: string): number {
  const metrics = ctx.measureText(text)
  return metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? 0
}

/** Kecilkan ukuran font bila teks melebihi lebar kotak desain. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  family: string,
  maxWidth?: number,
): number {
  let actual = size
  if (!maxWidth) return actual
  ctx.font = font(actual, family)
  while (actual > size * 0.6 && ctx.measureText(text).width > maxWidth) {
    actual -= 1
    ctx.font = font(actual, family)
  }
  return actual
}

interface TextOptions {
  text: string
  x: number
  /** Titik atas kotak teks Canva (bukan baseline). */
  top: number
  size: number
  family: string
  color: string
  align?: CanvasTextAlign
  maxWidth?: number
}

/** Menggambar satu baris teks persis pada kotak teks Canva. */
function drawText(ctx: CanvasRenderingContext2D, opts: TextOptions) {
  const size = fitSize(ctx, opts.text, opts.size, opts.family, opts.maxWidth)
  ctx.save()
  ctx.font = font(size, opts.family)
  ctx.fillStyle = opts.color
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(opts.text, opts.x, opts.top + ascentOf(ctx, opts.text))
  ctx.restore()
}

/** Beberapa baris teks dengan jarak baris tetap (blok alamat). */
function drawLines(
  ctx: CanvasRenderingContext2D,
  opts: {
    lines: string[]
    centerX: number
    top: number
    size: number
    lineHeight: number
    family: string
    color: string
    maxWidth?: number
  },
) {
  const size = fitSize(ctx, opts.lines[0], opts.size, opts.family, opts.maxWidth)
  ctx.save()
  ctx.font = font(size, opts.family)
  ctx.fillStyle = opts.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const ascent = ascentOf(ctx, opts.lines[0])
  opts.lines.forEach((line, index) => {
    ctx.fillText(line, opts.centerX, opts.top + index * opts.lineHeight + ascent)
  })
  ctx.restore()
}

export function drawFront(canvas: HTMLCanvasElement, assets: CardAssets, content: CardContent) {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = CARD_WIDTH
  const H = CARD_HEIGHT
  const s = W / 1600
  const L = LAYOUT.front

  ctx.clearRect(0, 0, W, H)

  // Latar + ornamen emas + logo panah (posisi persis dari Canva).
  drawCover(ctx, assets.background, -0.0539 * W, -0.0302 * H, 1.1078 * W, 1.0605 * H)
  drawAt(ctx, assets.ribbon, 0.1239 * W, 0.2236 * H, 0.9041 * W, 0.8108 * H)
  drawAt(ctx, assets.logo, 0.7202 * W, 0, 0.3537 * W, 0.2792 * H)

  drawText(ctx, {
    text: 'WISANGGENI CLIMBING CLUB',
    x: L.heading.x * s,
    top: L.heading.top * s,
    size: L.heading.size * s,
    family: FONT.heading,
    color: COLORS.red,
    maxWidth: 0.72 * W,
  })
  drawText(ctx, {
    text: 'Member Card',
    x: L.title.x * s,
    top: L.title.top * s,
    size: L.title.size * s,
    family: FONT.display,
    color: COLORS.white,
    maxWidth: 0.78 * W,
  })
  drawText(ctx, {
    text: `Name : ${content.name}`,
    x: L.name.x * s,
    top: L.name.top * s,
    size: L.name.size * s,
    family: FONT.body,
    color: COLORS.white,
    maxWidth: L.name.maxWidth * s,
  })
  drawText(ctx, {
    text: ROLE_LABEL[content.role],
    x: L.role.x * s,
    top: L.role.top * s,
    size: L.role.size * s,
    family: FONT.body,
    color: COLORS.white,
    maxWidth: L.role.maxWidth * s,
  })

  // QR Code existing: hanya ditempatkan, isi & token tidak diubah.
  // Bingkai putih mengikuti kotak QR pada desain Canva.
  const qr = L.qr
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(qr.x * s, qr.y * s, qr.size * s, qr.size * s)
  const inner = qr.size * 0.88
  const inset = (qr.size - inner) / 2
  ctx.drawImage(assets.qr, (qr.x + inset) * s, (qr.y + inset) * s, inner * s, inner * s)
}

export function drawBack(canvas: HTMLCanvasElement, assets: CardAssets) {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = CARD_WIDTH
  const H = CARD_HEIGHT
  const s = W / 1600
  const L = LAYOUT.back

  ctx.clearRect(0, 0, W, H)

  drawCover(ctx, assets.background, -0.0539 * W, -0.0302 * H, 1.1078 * W, 1.0605 * H)
  drawAt(ctx, assets.ribbon, 0.1239 * W, 0.2236 * H, 0.9041 * W, 0.8108 * H)
  drawAt(ctx, assets.logo, 0.7202 * W, 0, 0.3537 * W, 0.2792 * H)

  // Ikon kontak (aset asli dari Canva).
  drawAt(ctx, assets.whatsapp, 0.0542 * W, 0.3097 * H, 0.0529 * W, 0.075 * H)
  drawAt(ctx, assets.instagram, 0.0542 * W, 0.4289 * H, 0.0504 * W, 0.071 * H)
  drawAt(ctx, assets.pin, 0.0609 * W, 0.5674 * H, 0.0463 * W, 0.0887 * H)

  drawText(ctx, {
    text: 'WISANGGENI CLIMBING CLUB',
    x: L.heading.centerX * s,
    top: L.heading.top * s,
    size: L.heading.size * s,
    family: FONT.heading,
    color: COLORS.red,
    align: 'center',
    maxWidth: L.heading.maxWidth * s,
  })
  drawText(ctx, {
    text: 'jika menemukan KTA ini harap dikembalikan ke alamat atau hubungi CP yang tertera',
    x: L.note.x * s,
    top: L.note.top * s,
    size: L.note.size * s,
    family: FONT.heading,
    color: COLORS.white,
  })
  drawText(ctx, {
    text: '0851-7526-1027',
    x: L.phone.x * s,
    top: L.phone.top * s,
    size: L.phone.size * s,
    family: FONT.heading,
    color: COLORS.white,
  })
  drawText(ctx, {
    text: 'wcc_climbingclub',
    x: L.instagram.x * s,
    top: L.instagram.top * s,
    size: L.instagram.size * s,
    family: FONT.heading,
    color: COLORS.white,
  })

  drawLines(ctx, {
    lines: [
      'Jl. Wisanggeni No. 8 (Komp. GOR Wisanggeni), Kelurahan Kejambon, Kecamatan Tegal Timur,',
      'Kota Tegal, Jawa Tengah 52124',
    ],
    centerX: L.address.centerX * s,
    top: L.address.top * s,
    size: L.address.size * s,
    lineHeight: L.address.lineHeight * s,
    family: FONT.heading,
    color: COLORS.white,
    maxWidth: L.address.maxWidth * s,
  })

  drawText(ctx, {
    text: 'wisanggeniclub.site',
    x: L.website.x * s,
    top: L.website.top * s,
    size: L.website.size * s,
    family: FONT.heading,
    color: COLORS.website,
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Gagal membuat gambar PNG.'))
    }, 'image/png')
  })
}

export async function downloadPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** PDF 2 halaman (depan & belakang) tanpa dependensi eksternal. */
export function buildCardPdf(canvases: HTMLCanvasElement[]): Blob {
  const encoder = new TextEncoder()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const offsets: number[] = []
  let length = 0

  const push = (data: Uint8Array<ArrayBuffer> | string) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }

  const pushObject = (id: number, body: string) => {
    offsets[id] = length
    push(`${id} 0 obj\n${body}\nendobj\n`)
  }

  // Ukuran kartu 3,5 inci; rasio mengikuti desain Canva (1600 : 1135).
  const pageWidth = 3.5 * 72
  const pageHeight = (pageWidth * CARD_HEIGHT) / CARD_WIDTH
  const pageCount = canvases.length
  const firstPageId = 3
  const maxObjectId = 2 + pageCount * 3
  const pageIds = canvases.map((_, index) => firstPageId + index * 3)

  push('%PDF-1.4\n')

  pushObject(1, '<< /Type /Catalog /Pages 2 0 R >>')
  pushObject(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  )

  canvases.forEach((canvas, index) => {
    const pageId = firstPageId + index * 3
    const contentId = pageId + 1
    const imageId = pageId + 2
    const jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.95))

    pushObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(
        2,
      )}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )

    const content = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(
      2,
    )} 0 0 cm\n/Im0 Do\nQ\n`
    offsets[contentId] = length
    push(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`)

    offsets[imageId] = length
    push(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${CARD_WIDTH} /Height ${CARD_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    )
    push(jpeg)
    push('\nendstream\nendobj\n')
  })

  const xrefOffset = length
  push(`xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`)
  for (let id = 1; id <= maxObjectId; id += 1) {
    push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`)
  }
  push(`trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  return new Blob(chunks, { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
