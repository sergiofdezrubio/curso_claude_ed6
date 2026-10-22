import request from 'supertest'
import jwt from 'jsonwebtoken'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { JWT_SECRET } from '@config/env.js'

// Filas de la tabla «Verificación manual» del plan, ejecutadas contra la app real y SQLite en memoria.

const tokenDe = (id: string, role: string, restaurantId: string | null): string =>
    jwt.sign({ id, role, restaurantId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })

const tokenCliente = tokenDe('cli-1', 'cliente', null)
const tokenClienteAjeno = tokenDe('cli-2', 'cliente', null)
const tokenCamareroRest1 = tokenDe('cam-1', 'camarero', 'rest-1')
const tokenCocineroRest1 = tokenDe('coc-1', 'cocinero', 'rest-1')
const tokenCamareroRest2 = tokenDe('cam-2', 'camarero', 'rest-2')
const tokenAdmin = tokenDe('admin-1', 'admin', null)

const ahora = new Date().toISOString()

async function insertarRestaurante(id: string): Promise<void> {
    await dbConfig.run(
        `INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, logo_url, created_at, updated_at)
         VALUES (?, ?, 'Calle 1', ?, '600000000', 'Ana', 'Pérez', NULL, ?, ?)`,
        [id, `Restaurante ${id}`, `${id}@resttek.com`, ahora, ahora]
    )
}

async function insertarPlato(id: string, restaurantId: string): Promise<void> {
    await dbConfig.run(
        `INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at)
         VALUES (?, 'Tortilla', NULL, 8.5, 'principal', 1, ?, ?, ?)`,
        [id, restaurantId, ahora, ahora]
    )
}

async function insertarPedido(id: string, restaurantId: string, clientId: string | null, itemId: string, dishId: string, status: string): Promise<void> {
    await dbConfig.run(
        'INSERT INTO orders (id, restaurant_id, table_id, client_id, created_at) VALUES (?, ?, NULL, ?, ?)',
        [id, restaurantId, clientId, ahora]
    )
    await dbConfig.run(
        'INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status) VALUES (?, ?, ?, 1, NULL, ?)',
        [itemId, id, dishId, status]
    )
}

describe('Pedidos por HTTP (verificación manual del plan)', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        await insertarRestaurante('rest-1')
        await insertarRestaurante('rest-2')
        await insertarPlato('dish-1', 'rest-1')
        await insertarPlato('dish-2', 'rest-2')
        await insertarPedido('pedido-r1', 'rest-1', 'cli-1', 'item-r1', 'dish-1', 'listo')
        await insertarPedido('pedido-r2', 'rest-2', 'cli-2', 'item-r2', 'dish-2', 'pendiente')
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    describe('GET /api/v1/orders/active', () => {
        it('un cliente recibe 403', async () => {
            const res = await request(app).get('/api/v1/orders/active').set('Authorization', `Bearer ${tokenCliente}`)
            expect(res.status).toBe(403)
        })

        it('un camarero de rest-1 pidiendo rest-2 recibe 403', async () => {
            const res = await request(app)
                .get('/api/v1/orders/active?restaurantId=rest-2')
                .set('Authorization', `Bearer ${tokenCamareroRest1}`)
            expect(res.status).toBe(403)
        })

        it('un camarero de rest-1 recibe 200 con los pedidos de su restaurante', async () => {
            const res = await request(app).get('/api/v1/orders/active').set('Authorization', `Bearer ${tokenCamareroRest1}`)
            expect(res.status).toBe(200)
            expect(res.body.map((o: { id: string }) => o.id)).toEqual(['pedido-r1'])
        })

        it('un admin puede consultar otro restaurante por query', async () => {
            const res = await request(app)
                .get('/api/v1/orders/active?restaurantId=rest-2')
                .set('Authorization', `Bearer ${tokenAdmin}`)
            expect(res.status).toBe(200)
            expect(res.body.map((o: { id: string }) => o.id)).toEqual(['pedido-r2'])
        })
    })

    describe('PATCH /api/v1/orders/:id/items/:itemId/status', () => {
        const patch = (token: string, orderId: string, itemId: string, status: string) =>
            request(app)
                .patch(`/api/v1/orders/${orderId}/items/${itemId}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status })

        it('un cocinero no puede marcar como entregado (403)', async () => {
            const res = await patch(tokenCocineroRest1, 'pedido-r1', 'item-r1', 'entregado')
            expect(res.status).toBe(403)
        })

        it('un camarero de otro restaurante recibe 404', async () => {
            const res = await patch(tokenCamareroRest2, 'pedido-r1', 'item-r1', 'entregado')
            expect(res.status).toBe(404)
        })

        it('un camarero del mismo restaurante entrega un item listo', async () => {
            const res = await patch(tokenCamareroRest1, 'pedido-r1', 'item-r1', 'entregado')
            expect(res.status).toBeLessThan(300)
            const fila = await dbConfig.get<{ status: string }>('SELECT status FROM order_items WHERE id = ?', ['item-r1'])
            expect(fila?.status).toBe('entregado')
        })
    })

    describe('GET /api/v1/orders/:id', () => {
        it('personal de otro restaurante recibe 404', async () => {
            const res = await request(app).get('/api/v1/orders/pedido-r1').set('Authorization', `Bearer ${tokenCamareroRest2}`)
            expect(res.status).toBe(404)
        })

        it('un cliente ajeno recibe 404', async () => {
            const res = await request(app).get('/api/v1/orders/pedido-r1').set('Authorization', `Bearer ${tokenClienteAjeno}`)
            expect(res.status).toBe(404)
        })

        it('el cliente dueño recibe 200', async () => {
            const res = await request(app).get('/api/v1/orders/pedido-r1').set('Authorization', `Bearer ${tokenCliente}`)
            expect(res.status).toBe(200)
            expect(res.body.id).toBe('pedido-r1')
        })

        it('el personal del mismo restaurante recibe 200', async () => {
            const res = await request(app).get('/api/v1/orders/pedido-r1').set('Authorization', `Bearer ${tokenCamareroRest1}`)
            expect(res.status).toBe(200)
        })
    })

    describe('POST /api/v1/orders', () => {
        it('quantity 100000000 responde 400 y el servidor sigue respondiendo', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${tokenCliente}`)
                .send({ restaurantId: 'rest-1', items: [{ dishId: 'dish-1', quantity: 100000000, notes: null }] })
            expect(res.status).toBe(400)

            const health = await request(app).get('/health')
            expect(health.status).toBe(200)
        })

        it('un pedido válido de un cliente responde 201 con su clientId', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${tokenCliente}`)
                .send({ restaurantId: 'rest-1', clientId: 'suplantado', items: [{ dishId: 'dish-1', quantity: 2, notes: null }] })
            expect(res.status).toBe(201)
            expect(res.body.clientId).toBe('cli-1')
            expect(res.body.items).toHaveLength(2)
        })
    })
})
