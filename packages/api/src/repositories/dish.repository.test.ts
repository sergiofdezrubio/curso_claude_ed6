import { SqliteDishRepository } from './dish.repository.js'
import { Database } from '@config/database.js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('SqliteDishRepository (Integration)', () => {
    let db: Database
    let repo: SqliteDishRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteDishRepository(db)

        const now = new Date().toISOString()
        for (const id of ['rest-1', 'rest-2']) {
            await db.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `R ${id}`, 'Calle Mayor 10', `${id}@r.com`, '+34 612345678', 'Carlos', 'García', now, now]
            )
        }
        await repo.save({
            id: 'd2', name: 'Paella', description: null, price: 12, category: 'principal',
            available: true, restaurantId: 'rest-2', ingredients: [], createdAt: now, updatedAt: now
        })
    })

    afterAll(async () => {
        await db.close()
    })

    it('findById solo devuelve el plato si pertenece al restaurante', async () => {
        expect(await repo.findById('d2', 'rest-1')).toBeNull()
        expect((await repo.findById('d2', 'rest-2'))?.id).toBe('d2')
    })

    it('delete con otro restaurante no borra el plato', async () => {
        await repo.delete('d2', 'rest-1')
        expect(await repo.findById('d2', 'rest-2')).not.toBeNull()
    })
})
