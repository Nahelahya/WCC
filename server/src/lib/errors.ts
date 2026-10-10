/** Kesalahan HTTP dengan status code yang jelas. */
export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }

  static badRequest(message = 'Permintaan tidak valid.', details?: unknown) {
    return new ApiError(400, message, details)
  }
  static unauthorized(message = 'Anda belum masuk atau sesi sudah berakhir.') {
    return new ApiError(401, message)
  }
  static forbidden(message = 'Anda tidak memiliki akses untuk tindakan ini.') {
    return new ApiError(403, message)
  }
  static notFound(message = 'Data tidak ditemukan.') {
    return new ApiError(404, message)
  }
  static conflict(message = 'Data sudah ada.') {
    return new ApiError(409, message)
  }
  static badGateway(message = 'Layanan eksternal gagal merespons.') {
    return new ApiError(502, message)
  }
  static serviceUnavailable(message = 'Layanan belum tersedia atau belum dikonfigurasi.') {
    return new ApiError(503, message)
  }
  static notImplemented(message = 'Fitur belum tersedia.') {
    return new ApiError(501, message)
  }
}
