import request from 'supertest'
import jwt from 'jsonwebtoken'
import { describe, it, expect } from 'vitest'
import app from '../app.js'
import { JWT_SECRET } from '@config/env.js'

const tokenDe = (role: string): string =>
    jwt.sign({ id: 'usuario-prueba', role, restaurantId: null }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })

describe('Roles en las rutas de pedidos', () => {
    it('GET /active responde 403 a un cliente', async () => {
        const res = await request(app)
            .get('/api/v1/orders/active')
            .set('Authorization', `Bearer ${tokenDe('cliente')}`)

        expect(res.status).toBe(403)
    })

    it('PATCH /:orderId/items/:itemId/status responde 403 a un cliente', async () => {
        const res = await request(app)
            .patch('/api/v1/orders/x/items/y/status')
            .set('Authorization', `Bearer ${tokenDe('cliente')}`)
            .send({ status: 'preparing' })

        expect(res.status).toBe(403)
    })

    it('GET /active responde 401 sin token', async () => {
        const res = await request(app).get('/api/v1/orders/active')

        expect(res.status).toBe(401)
    })

    it('PATCH /:orderId/items/:itemId/status responde 401 sin token', async () => {
        const res = await request(app)
            .patch('/api/v1/orders/x/items/y/status')
            .send({ status: 'preparing' })

        expect(res.status).toBe(401)
    })
})
