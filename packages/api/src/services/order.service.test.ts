import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import type { Order } from '@models/order.model.js'
import { OrderNotFoundError, InvalidOrderStatusError, InvalidOrderItemsError } from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando')
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status'))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService.create (validación de items)', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const crear = (quantity: unknown) => service.create({
        restaurantId: 'rest-1',
        tableId: null,
        clientId: null,
        items: [{ dishId: 'dish-1', quantity: quantity as number, notes: null }]
    })

    const lineas = (n: number) =>
        Array.from({ length: n }, (_, i) => ({ dishId: `dish-${i}`, quantity: 1, notes: null }))

    beforeEach(() => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
    })

    it.each([0, 51, 100000000, -1, '5', 1.5, NaN, null, undefined])(
        'debe rechazar quantity %j sin generar líneas',
        async (quantity) => {
            await expect(crear(quantity)).rejects.toThrow(InvalidOrderItemsError)
            expect(repo.orders).toHaveLength(0)
        }
    )

    it('debe rechazar un pedido con items vacío', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: null, clientId: null, items: [] }))
            .rejects.toThrow(InvalidOrderItemsError)
    })

    it('debe rechazar items que no es un array', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: null, clientId: null, items: 'x' as never }))
            .rejects.toThrow(InvalidOrderItemsError)
    })

    it('debe rechazar un pedido con 31 líneas', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: null, clientId: null, items: lineas(31) }))
            .rejects.toThrow(InvalidOrderItemsError)
        expect(repo.orders).toHaveLength(0)
    })

    it.each(['', '   ', 5, null, undefined])('debe rechazar dishId %j', async (dishId) => {
        await expect(service.create({
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            items: [{ dishId: dishId as string, quantity: 1, notes: null }]
        })).rejects.toThrow(InvalidOrderItemsError)
        expect(repo.orders).toHaveLength(0)
    })

    it('debe crear un pedido válido', async () => {
        const order = await crear(2)
        expect(order.items).toHaveLength(2)
        expect(repo.orders).toHaveLength(1)
    })

    it('debe aceptar el límite de 30 líneas', async () => {
        const order = await service.create({ restaurantId: 'rest-1', tableId: null, clientId: null, items: lineas(30) })
        expect(order.items).toHaveLength(30)
    })

    it('debe aceptar quantity 50', async () => {
        const order = await crear(50)
        expect(order.items).toHaveLength(50)
    })
})
