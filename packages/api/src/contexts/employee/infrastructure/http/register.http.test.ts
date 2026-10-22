import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../../app.js'
import { dbConfig } from '@config/database.js'

describe('POST /api/v1/auth/register - validación de contraseña', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    const base = { firstName: 'Ana', lastName: 'Pérez' }

    it.each([
        ['vacía', 'vacia', { password: '' }],
        ['ausente', 'ausente', {}],
        ['de 9 caracteres', 'nueve', { password: '123456789' }],
        ['de 73 bytes', 'setentaytres', { password: 'a'.repeat(73) }]
    ])('devuelve 400 InvalidPasswordError con contraseña %s', async (_nombre, id, extra) => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...base, email: `ana.${id}@example.com`, ...extra })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('InvalidPasswordError')
    })

    it('devuelve 201 con una contraseña válida y un email nuevo', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...base, email: 'ana.valida@example.com', password: 'contraseña-valida-123' })
        expect(res.status).toBe(201)
    })
})
