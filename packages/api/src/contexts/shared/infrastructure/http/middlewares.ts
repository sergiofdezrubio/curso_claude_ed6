import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '@config/env.js'
import type { EmployeeRoleType } from '@employee/domain/value-objects/Role.js'

// Usuario autenticado tal y como lo firman LoginUseCase y RegisterClientUseCase.
// restaurantId es null para usuarios sin restaurante (admin y clientes).
export interface AuthUser {
    id: string
    role: EmployeeRoleType
    restaurantId: string | null
}

export interface AuthRequest extends Request {
    user?: AuthUser
}

const ROLES_VALIDOS: readonly string[] = ['admin', 'manager', 'camarero', 'cocinero', 'cliente']

function toAuthUser(decoded: unknown): AuthUser | null {
    if (typeof decoded !== 'object' || decoded === null) return null
    const { id, role, restaurantId } = decoded as Record<string, unknown>
    if (typeof id !== 'string' || typeof role !== 'string' || !ROLES_VALIDOS.includes(role)) return null
    if (restaurantId !== undefined && restaurantId !== null && typeof restaurantId !== 'string') return null
    return { id, role: role as EmployeeRoleType, restaurantId: restaurantId ?? null }
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' })
        return
    }

    const tokenParts = authHeader.split(' ')
    const token = tokenParts[1]
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Malformed token' })
        return
    }

    try {
        const user = toAuthUser(jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }))
        if (!user) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' })
            return
        }
        req.user = user
        next()
    } catch {
        res.status(401).json({ error: 'Unauthorized: Invalid token' })
    }
}

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
            return
        }
        next()
    }
}
