import type { Response, NextFunction } from 'express'
import { describe, it, expect, vi } from 'vitest'
import { requireSameRestaurant, type AuthRequest, type AuthUser } from '@shared/infrastructure/http/middlewares.js'

const ejecutar = (user: AuthUser | undefined, restaurantId: string) => {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    const next = vi.fn()
    const req = { user, params: { restaurantId } } as unknown as AuthRequest
    requireSameRestaurant(req, { status } as unknown as Response, next as NextFunction)
    return { status, json, next }
}

describe('requireSameRestaurant', () => {
    it('deja pasar al admin aunque no tenga restaurante', () => {
        const { next, status } = ejecutar({ id: 'u1', role: 'admin', restaurantId: null }, 'r1')
        expect(next).toHaveBeenCalledOnce()
        expect(status).not.toHaveBeenCalled()
    })

    it('deja pasar al usuario del mismo restaurante', () => {
        const { next, status } = ejecutar({ id: 'u2', role: 'manager', restaurantId: 'r1' }, 'r1')
        expect(next).toHaveBeenCalledOnce()
        expect(status).not.toHaveBeenCalled()
    })

    it('responde 403 si el restaurante es otro', () => {
        const { next, status, json } = ejecutar({ id: 'u2', role: 'manager', restaurantId: 'r2' }, 'r1')
        expect(next).not.toHaveBeenCalled()
        expect(status).toHaveBeenCalledWith(403)
        expect(json).toHaveBeenCalledWith({ error: 'Prohibido: no tienes acceso a este restaurante' })
    })

    it('responde 403 si el usuario no tiene restaurante', () => {
        const { next, status } = ejecutar({ id: 'u3', role: 'cliente', restaurantId: null }, 'r1')
        expect(next).not.toHaveBeenCalled()
        expect(status).toHaveBeenCalledWith(403)
    })

    it('responde 403 si no hay req.user', () => {
        const { next, status } = ejecutar(undefined, 'r1')
        expect(next).not.toHaveBeenCalled()
        expect(status).toHaveBeenCalledWith(403)
    })
})
