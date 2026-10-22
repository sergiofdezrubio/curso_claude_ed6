import type { Request, Response, NextFunction } from 'express'
import { describe, it, expect, vi } from 'vitest'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'
import { ForbiddenActionError, OrderNotFoundError, InvalidOrderStatusError } from '@errors/DomainErrors.js'

const ejecutar = (err: unknown) => {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    errorHandler(err, {} as Request, { status } as unknown as Response, vi.fn() as NextFunction)
    return { status, json }
}

describe('errorHandler', () => {
    it('OrderNotFoundError -> 404', () => {
        const { status, json } = ejecutar(new OrderNotFoundError())
        expect(status).toHaveBeenCalledWith(404)
        expect(json).toHaveBeenCalledWith({ error: 'OrderNotFoundError', message: 'Order not found' })
    })

    it('ForbiddenActionError -> 403', () => {
        const { status } = ejecutar(new ForbiddenActionError())
        expect(status).toHaveBeenCalledWith(403)
    })

    it('un AppError sin mapear -> 400', () => {
        const { status } = ejecutar(new InvalidOrderStatusError())
        expect(status).toHaveBeenCalledWith(400)
    })

    it('un error desconocido -> 500 genérico sin filtrar el mensaje', () => {
        const { status, json } = ejecutar(new Error('secreto interno'))
        expect(status).toHaveBeenCalledWith(500)
        expect(json).toHaveBeenCalledWith({ error: 'InternalServerError', message: 'Something went wrong' })
    })
})
