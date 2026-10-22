import { randomUUID } from 'crypto'
import type { Order, OrderItem } from '@models/order.model.js'
import { normalizeOrderStatus } from '@models/order.model.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import { RestaurantIdRequiredError, OrderNotFoundError, InvalidOrderItemsError } from '@errors/DomainErrors.js'

export interface CreateOrderRequest {
    restaurantId: string
    tableId: string | null
    clientId: string | null
    items: {
        dishId: string
        quantity: number
        notes: string | null
    }[]
}

const MAX_LINEAS_PEDIDO = 30
const MAX_CANTIDAD_POR_LINEA = 50

function validarItems(items: unknown): void {
    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_LINEAS_PEDIDO) {
        throw new InvalidOrderItemsError(`El pedido debe tener entre 1 y ${MAX_LINEAS_PEDIDO} líneas`)
    }
    for (const item of items) {
        if (typeof item?.dishId !== 'string' || item.dishId.trim() === '') {
            throw new InvalidOrderItemsError('El identificador del plato es obligatorio')
        }
        const { quantity } = item
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CANTIDAD_POR_LINEA) {
            throw new InvalidOrderItemsError(`La cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD_POR_LINEA}`)
        }
    }
}

export class OrderService {
    constructor(private readonly orderRepository: OrderRepository) {}

    async create(request: CreateOrderRequest): Promise<Order> {
        if (!request.restaurantId || request.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        validarItems(request.items)

        const items: OrderItem[] = []
        for (const item of request.items) {
            for (let i = 0; i < item.quantity; i++) {
                items.push({
                    id: randomUUID(),
                    dishId: item.dishId,
                    quantity: 1,
                    notes: item.notes,
                    status: 'pendiente'
                })
            }
        }

        const order: Order = {
            id: randomUUID(),
            restaurantId: request.restaurantId,
            tableId: request.tableId,
            clientId: request.clientId,
            createdAt: new Date(),
            items
        }

        await this.orderRepository.create(order)

        return order
    }

    async listActive(restaurantId: string): Promise<Order[]> {
        return this.orderRepository.findActiveByRestaurant(restaurantId)
    }

    async getById(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findById(orderId)
        if (!order) {
            throw new OrderNotFoundError()
        }
        return order
    }

    async getByClientId(clientId: string): Promise<Order[]> {
        return this.orderRepository.findByClientId(clientId)
    }

    async updateItemStatus(orderId: string, itemId: string, status: string): Promise<void> {
        const order = await this.orderRepository.findById(orderId)
        if (!order) {
            throw new OrderNotFoundError()
        }

        const item = order.items.find(i => i.id === itemId)
        if (!item) {
            throw new OrderNotFoundError() // Or ItemNotFoundError
        }

        const normalizedStatus = normalizeOrderStatus(status)
        item.status = normalizedStatus

        await this.orderRepository.updateItemStatus(orderId, itemId, normalizedStatus)
    }
}
