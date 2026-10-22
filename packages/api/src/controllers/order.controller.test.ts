import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JWT_SECRET } from '@config/env.js'
import { OrderController } from '@controllers/order.controller.js'
import { authenticate } from '@shared/infrastructure/http/middlewares.js'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'
import { ForbiddenActionError, OrderNotFoundError } from '@errors/DomainErrors.js'
import type { OrderService } from '@services/order.service.js'

const firmar = (payload: Record<string, unknown>): string =>
    `Bearer ${jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' })}`

const camarero = firmar({ id: 'u1', role: 'camarero', restaurantId: 'rest-1' })
const admin = firmar({ id: 'a1', role: 'admin', restaurantId: null })

describe('OrderController', () => {
    let servicio: Record<string, ReturnType<typeof vi.fn>>
    let app: express.Express

    beforeEach(() => {
        servicio = {
            create: vi.fn(),
            listActive: vi.fn().mockResolvedValue([]),
            getById: vi.fn(),
            listMine: vi.fn(),
            updateItemStatus: vi.fn()
        }
        const controlador = new OrderController(servicio as unknown as OrderService)
        app = express()
        app.use(express.json())
        app.get('/active', authenticate, controlador.getActiveOrders.bind(controlador))
        app.get('/:id', authenticate, controlador.getById.bind(controlador))
        app.post('/', authenticate, controlador.createOrder.bind(controlador))
        app.use(errorHandler)
    })

    describe('errores', () => {
        it('un pedido inexistente responde 404', async () => {
            servicio.getById!.mockRejectedValue(new OrderNotFoundError())
            const res = await request(app).get('/x').set('Authorization', camarero)
            expect(res.status).toBe(404)
            expect(res.body.error).toBe('OrderNotFoundError')
        })

        it('ForbiddenActionError responde 403', async () => {
            servicio.getById!.mockRejectedValue(new ForbiddenActionError())
            const res = await request(app).get('/x').set('Authorization', camarero)
            expect(res.status).toBe(403)
            expect(res.body.error).toBe('ForbiddenActionError')
        })

        it('un TypeError o error de SQLite responde 500 genérico sin filtrar el mensaje', async () => {
            servicio.getById!.mockRejectedValue(new Error('SQLITE_ERROR: no such table: orders'))
            const res = await request(app).get('/x').set('Authorization', camarero)
            expect(res.status).toBe(500)
            expect(res.body).toEqual({ error: 'InternalServerError', message: 'Something went wrong' })
            expect(JSON.stringify(res.body)).not.toContain('SQLITE')
        })

        it('createOrder ya no responde 400 a un error inesperado', async () => {
            servicio.create!.mockRejectedValue(new TypeError('x is undefined'))
            const res = await request(app).post('/').set('Authorization', camarero)
                .send({ restaurantId: 'rest-1', items: [] })
            expect(res.status).toBe(500)
            expect(JSON.stringify(res.body)).not.toContain('undefined')
        })
    })

    describe('GET /active', () => {
        it('sin query usa el restaurantId del token', async () => {
            const res = await request(app).get('/active').set('Authorization', camarero)
            expect(res.status).toBe(200)
            expect(servicio.listActive).toHaveBeenCalledWith('rest-1', expect.objectContaining({ id: 'u1' }))
        })

        it('con query igual a la del token responde 200', async () => {
            const res = await request(app).get('/active?restaurantId=rest-1').set('Authorization', camarero)
            expect(res.status).toBe(200)
        })

        it('con restaurantId de otro restaurante en la query responde 403', async () => {
            const res = await request(app).get('/active?restaurantId=rest-2').set('Authorization', camarero)
            expect(res.status).toBe(403)
            expect(servicio.listActive).not.toHaveBeenCalled()
        })

        it('un no admin sin restaurantId en el token responde 403', async () => {
            const token = firmar({ id: 'c1', role: 'cliente', restaurantId: null })
            const res = await request(app).get('/active?restaurantId=rest-1').set('Authorization', token)
            expect(res.status).toBe(403)
        })

        it('el admin puede pasar restaurantId por query', async () => {
            const res = await request(app).get('/active?restaurantId=rest-2').set('Authorization', admin)
            expect(res.status).toBe(200)
            expect(servicio.listActive).toHaveBeenCalledWith('rest-2', expect.objectContaining({ id: 'a1' }))
        })

        it('el admin sin restaurante en el token y sin query recibe 400', async () => {
            const res = await request(app).get('/active').set('Authorization', admin)
            expect(res.status).toBe(400)
        })
    })

    describe('POST /', () => {
        it('no lee clientId del body y toma restaurantId del body', async () => {
            servicio.create!.mockResolvedValue({ id: 'o1' })
            const res = await request(app).post('/').set('Authorization', camarero)
                .send({ restaurantId: 'rest-9', clientId: 'otro', items: [] })
            expect(res.status).toBe(201)
            const peticion = servicio.create!.mock.calls[0]![0]
            expect(peticion.restaurantId).toBe('rest-9')
            expect(peticion).not.toHaveProperty('clientId')
        })
    })
})
