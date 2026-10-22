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

    describe('aislamiento por restaurante (datos intactos)', () => {
        const now = new Date().toISOString()

        beforeAll(async () => {
            await db.run(
                'INSERT INTO ingredients (id, name, unit, current_stock, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['ing-r2', 'Arroz', 'kg', 10, 'rest-2', now, now]
            )
            await repo.save({
                id: 'd3', name: 'Fideua', description: 'original', price: 15, category: 'principal',
                available: true, restaurantId: 'rest-2',
                ingredients: [{ ingredientId: 'ing-r2', quantity: 2 }], createdAt: now, updatedAt: now
            })
        })

        it('save con un restaurantId distinto no modifica el plato ni sus ingredientes', async () => {
            await repo.save({
                id: 'd3', name: 'Hackeado', description: null, price: 1, category: 'postre',
                available: false, restaurantId: 'rest-1', ingredients: [], createdAt: now, updatedAt: now
            }).catch(() => undefined)

            const found = await repo.findById('d3', 'rest-2')
            expect(found?.name).toBe('Fideua')
            expect(found?.description).toBe('original')
            expect(found?.price).toBe(15)
            expect(found?.available).toBe(true)
            expect(found?.ingredients).toEqual([{ ingredientId: 'ing-r2', quantity: 2 }])
            expect(await repo.findById('d3', 'rest-1')).toBeNull()
        })

        it('delete con otro restaurante no borra los ingredientes del plato', async () => {
            await repo.delete('d3', 'rest-1')
            const found = await repo.findById('d3', 'rest-2')
            expect(found?.ingredients).toEqual([{ ingredientId: 'ing-r2', quantity: 2 }])
        })
    })
})
