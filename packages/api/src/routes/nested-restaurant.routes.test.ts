import request from 'supertest'
import jwt from 'jsonwebtoken'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../app.js'
import { JWT_SECRET } from '@config/env.js'
import { dbConfig } from '@config/database.js'

const tokenDe = (role: string, restaurantId: string | null): string =>
    jwt.sign({ id: 'usuario-prueba', role, restaurantId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })

describe('Aislamiento por restaurante en rutas anidadas de ingredientes y platos', () => {
    it('GET ingredientes de otro restaurante responde 403 a un manager', async () => {
        const res = await request(app)
            .get('/api/v1/restaurants/rest-2/ingredients')
            .set('Authorization', `Bearer ${tokenDe('manager', 'rest-1')}`)

        expect(res.status).toBe(403)
    })

    it('GET platos de otro restaurante responde 403 a un manager', async () => {
        const res = await request(app)
            .get('/api/v1/restaurants/rest-2/dishes')
            .set('Authorization', `Bearer ${tokenDe('manager', 'rest-1')}`)

        expect(res.status).toBe(403)
    })

    it('GET platos concretos de otro restaurante responde 403 a un manager', async () => {
        const res = await request(app)
            .get('/api/v1/restaurants/rest-2/dishes/plato-x')
            .set('Authorization', `Bearer ${tokenDe('manager', 'rest-1')}`)

        expect(res.status).toBe(403)
    })

    it('POST platos de otro restaurante responde 403 a un manager', async () => {
        const res = await request(app)
            .post('/api/v1/restaurants/rest-2/dishes')
            .set('Authorization', `Bearer ${tokenDe('manager', 'rest-1')}`)
            .send({})

        expect(res.status).toBe(403)
    })

    it('DELETE ingredientes de otro restaurante responde 403 a un admin de otro restaurante', async () => {
        const res = await request(app)
            .delete('/api/v1/restaurants/rest-2/ingredients/ing-x')
            .set('Authorization', `Bearer ${tokenDe('admin', 'rest-1')}`)

        expect(res.status).not.toBe(403)
    })

    it('un admin sin restaurante asignado no recibe 403 en ingredientes ni platos', async () => {
        const ing = await request(app)
            .get('/api/v1/restaurants/rest-2/ingredients')
            .set('Authorization', `Bearer ${tokenDe('admin', null)}`)
        const dishes = await request(app)
            .get('/api/v1/restaurants/rest-2/dishes')
            .set('Authorization', `Bearer ${tokenDe('admin', null)}`)

        expect(ing.status).not.toBe(403)
        expect(dishes.status).not.toBe(403)
    })

    it('un manager sin restaurante asignado recibe 403', async () => {
        const res = await request(app)
            .get('/api/v1/restaurants/rest-1/ingredients')
            .set('Authorization', `Bearer ${tokenDe('manager', null)}`)

        expect(res.status).toBe(403)
    })

    it('un manager de rest-1 no recibe 403 en su propio restaurante', async () => {
        const ing = await request(app)
            .get('/api/v1/restaurants/rest-1/ingredients')
            .set('Authorization', `Bearer ${tokenDe('manager', 'rest-1')}`)
        const dishes = await request(app)
            .get('/api/v1/restaurants/rest-1/dishes')
            .set('Authorization', `Bearer ${tokenDe('manager', 'rest-1')}`)

        expect(ing.status).not.toBe(403)
        expect(dishes.status).not.toBe(403)
    })

    it('sin token sigue respondiendo 401', async () => {
        const res = await request(app).get('/api/v1/restaurants/rest-2/ingredients')

        expect(res.status).toBe(401)
    })

    describe('con BD en memoria real', () => {
        const ahora = new Date().toISOString()

        beforeAll(async () => {
            await dbConfig.initialize()
            for (const id of ['rest-1', 'rest-2']) {
                await dbConfig.run(
                    'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [id, `R ${id}`, 'Calle Mayor 10', `${id}@r.com`, '+34 612345678', 'Carlos', 'García', ahora, ahora]
                )
            }
            await dbConfig.run(
                'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ['plato-rest-2', 'Paella', null, 12, 'principal', 1, 'rest-2', ahora, ahora]
            )
        })

        afterAll(async () => {
            await dbConfig.close()
        })

        it('DELETE de un plato de rest-2 por la ruta de rest-1 responde 404 y el plato sigue existiendo', async () => {
            const res = await request(app)
                .delete('/api/v1/restaurants/rest-1/dishes/plato-rest-2')
                .set('Authorization', `Bearer ${tokenDe('manager', 'rest-1')}`)

            expect(res.status).toBe(404)
            const fila = await dbConfig.get<{ id: string }>('SELECT id FROM dishes WHERE id = ?', ['plato-rest-2'])
            expect(fila?.id).toBe('plato-rest-2')
        })
    })
})
