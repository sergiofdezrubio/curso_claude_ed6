import { describe, it, expect, beforeEach } from 'vitest'
import { DishService } from '@services/dish.service.js'
import { MockDishRepository } from '@repositories/mocks/MockDishRepository.js'
import { DishNotFoundError } from '@errors/DomainErrors.js'

describe('DishService - aislamiento por restaurante', () => {
    let service: DishService
    let dishId: string

    beforeEach(async () => {
        service = new DishService(new MockDishRepository())
        const dish = await service.create({
            name: 'Paella', description: null, price: 12, category: 'principal',
            available: true, restaurantId: 'rest-2', ingredients: []
        })
        dishId = dish.id
    })

    it('findById devuelve null para un plato de otro restaurante', async () => {
        expect(await service.findById(dishId, 'rest-1')).toBeNull()
        expect(await service.findById(dishId, 'rest-2')).not.toBeNull()
    })

    it('delete de un plato de otro restaurante lanza DishNotFoundError y no lo borra', async () => {
        await expect(service.delete(dishId, 'rest-1')).rejects.toBeInstanceOf(DishNotFoundError)
        expect(await service.findById(dishId, 'rest-2')).not.toBeNull()
    })

    it('update de un plato de otro restaurante lanza DishNotFoundError', async () => {
        await expect(service.update(dishId, 'rest-1', {
            name: 'Hackeado', description: null, price: 1, category: 'principal',
            available: true, ingredients: []
        })).rejects.toBeInstanceOf(DishNotFoundError)
        expect((await service.findById(dishId, 'rest-2'))?.name).toBe('Paella')
    })
})
