import { randomUUID } from 'crypto'
import type { Order, OrderItem } from '@models/order.model.js'
import { normalizeOrderStatus } from '@models/order.model.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import type { AuthUser } from '@shared/infrastructure/http/middlewares.js'
import { RestaurantIdRequiredError, OrderNotFoundError, InvalidOrderItemsError, ForbiddenActionError } from '@errors/DomainErrors.js'

export interface CreateOrderRequest {
    restaurantId: string
    tableId: string | null
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

function esPersonal(user: AuthUser): boolean {
    return user.role === 'manager' || user.role === 'camarero' || user.role === 'cocinero'
}

// El personal solo opera en su restaurante; sin restaurante asignado no accede a nada.
function esDeSuRestaurante(user: AuthUser, restaurantId: string): boolean {
    return esPersonal(user) && user.restaurantId !== null && user.restaurantId === restaurantId
}

function puedeVerPedido(user: AuthUser, order: Order): boolean {
    if (user.role === 'admin') return true
    if (user.role === 'cliente') return order.clientId === user.id
    return esDeSuRestaurante(user, order.restaurantId)
}

export class OrderService {
    constructor(private readonly orderRepository: OrderRepository) {}

    async create(request: CreateOrderRequest, user: AuthUser): Promise<Order> {
        if (!request.restaurantId || request.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        // El cliente pide en cualquier restaurante público; el personal, solo en el suyo.
        if (esPersonal(user) && !esDeSuRestaurante(user, request.restaurantId)) {
            throw new ForbiddenActionError()
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
            // Nunca se toma del request: siempre el usuario autenticado.
            clientId: user.id,
            createdAt: new Date(),
            items
        }

        await this.orderRepository.create(order)

        return order
    }

    async listActive(restaurantId: string, user: AuthUser): Promise<Order[]> {
        if (user.role !== 'admin' && !esDeSuRestaurante(user, restaurantId)) {
            throw new ForbiddenActionError()
        }
        return this.orderRepository.findActiveByRestaurant(restaurantId)
    }

    async getById(orderId: string, user: AuthUser): Promise<Order> {
        return this.buscarPedidoAccesible(orderId, user)
    }

    async listMine(user: AuthUser): Promise<Order[]> {
        return this.orderRepository.findByClientId(user.id)
    }

    async updateItemStatus(orderId: string, itemId: string, status: string, user: AuthUser): Promise<void> {
        const order = await this.buscarPedidoAccesible(orderId, user)

        const item = order.items.find(i => i.id === itemId)
        if (!item) {
            throw new OrderNotFoundError() // Or ItemNotFoundError
        }

        const normalizedStatus = normalizeOrderStatus(status)
        item.status = normalizedStatus

        await this.orderRepository.updateItemStatus(orderId, itemId, normalizedStatus)
    }

    // Un pedido ajeno se trata como inexistente para no revelar que existe.
    private async buscarPedidoAccesible(orderId: string, user: AuthUser): Promise<Order> {
        const order = await this.orderRepository.findById(orderId)
        if (!order || !puedeVerPedido(user, order)) {
            throw new OrderNotFoundError()
        }
        return order
    }
}
