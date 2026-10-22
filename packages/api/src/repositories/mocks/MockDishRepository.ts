import type { DishRepository } from '@repositories/dish.repository.js'
import type { Dish } from '@models/dish.model.js'

export class MockDishRepository implements DishRepository {
    private dishes: Map<string, Dish> = new Map()

    async findById(id: string, restaurantId: string): Promise<Dish | null> {
        const dish = this.dishes.get(id)
        return dish && dish.restaurantId === restaurantId ? dish : null
    }

    async findByRestaurantId(restaurantId: string): Promise<Dish[]> {
        return Array.from(this.dishes.values()).filter(d => d.restaurantId === restaurantId)
    }

    async save(dish: Dish): Promise<void> {
        this.dishes.set(dish.id, dish)
    }

    async delete(id: string, restaurantId: string): Promise<void> {
        const dish = this.dishes.get(id)
        if (dish && dish.restaurantId === restaurantId) this.dishes.delete(id)
    }
}
