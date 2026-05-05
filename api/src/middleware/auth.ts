import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId: string
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing authorization header' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload
    if (!payload.sub) {
      res.status(401).json({ message: 'Invalid token: missing sub' })
      return
    }
    ;(req as AuthRequest).userId = payload.sub
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}
