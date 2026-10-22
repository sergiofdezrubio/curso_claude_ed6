import request from 'supertest'
import jwt from 'jsonwebtoken'
import { describe, it, expect } from 'vitest'
import app from '../app.js'
import { JWT_SECRET } from '@config/env.js'

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
})
