import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Membungkus handler async agar error yang dilempar otomatis diteruskan ke
 * middleware error Express (Express 4 tidak menangani promise yang reject).
 */
export function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
