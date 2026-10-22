import request from 'supertest'
import { describe, it, expect } from 'vitest'
import app from '../../../../app.js'

describe('POST /api/v1/auth/register - validación de contraseña', () => {
    const base = { firstName: 'Ana', lastName: 'Pérez', email: 'ana.http@example.com' }

    it.each([
        ['vacía', { password: '' }],
        ['ausente', {}],
        ['de 9 caracteres', { password: '123456789' }],
        ['de 73 bytes', { password: 'a'.repeat(73) }]
    ])('devuelve 400 con contraseña %s', async (_nombre, extra) => {
        const res = await request(app).post('/api/v1/auth/register').send({ ...base, ...extra })
        expect(res.status).toBe(400)
    })
})
