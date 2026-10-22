import { InvalidOrderStatusError } from '@errors/DomainErrors.js'
import type { EmployeeRoleType } from '@employee/domain/value-objects/Role.js'

const VALID_ORDER_STATUSES = ['pendiente', 'preparando', 'listo', 'entregado'] as const

export type OrderStatusType = typeof VALID_ORDER_STATUSES[number]

export interface OrderItem {
    id: string
    dishId: string
    quantity: number
    notes: string | null
    status: OrderStatusType
    dishName?: string
    dishPrice?: number
    dishCategory?: string
}

export interface Order {
    id: string
    restaurantId: string
    tableId: string | null
    clientId: string | null
    createdAt: Date
    items: OrderItem[]
    restaurantName?: string
    restaurantLogoUrl?: string | null
}

export function normalizeOrderStatus(value: string): OrderStatusType {
    const normalized = value.toLowerCase().trim()
    if (!VALID_ORDER_STATUSES.includes(normalized as OrderStatusType)) {
        throw new InvalidOrderStatusError(`Estado inválido: ${value}. Debe ser uno de: ${VALID_ORDER_STATUSES.join(', ')}`)
    }
    return normalized as OrderStatusType
}

export function isOrderFullyDelivered(order: Order): boolean {
    return order.items.length > 0 && order.items.every(item => item.status === 'entregado')
}

export interface TransicionEstado {
    desde: OrderStatusType
    hasta: OrderStatusType
}

// Todos los pares de estados válidos distintos: manager y admin pueden avanzar,
// saltar pasos y retroceder (p. ej. para corregir un error de cocina o de sala).
const TODAS_LAS_TRANSICIONES: readonly TransicionEstado[] = VALID_ORDER_STATUSES.flatMap(desde =>
    VALID_ORDER_STATUSES.filter(hasta => hasta !== desde).map(hasta => ({ desde, hasta }))
)

// Matriz rol → transiciones de estado de un item de pedido permitidas.
// Pasar al mismo estado no es una transición y no está permitido para ningún rol.
export const TRANSICIONES_POR_ROL: Readonly<Record<EmployeeRoleType, readonly TransicionEstado[]>> = {
    admin: TODAS_LAS_TRANSICIONES,
    manager: TODAS_LAS_TRANSICIONES,
    cocinero: [
        { desde: 'pendiente', hasta: 'preparando' },
        { desde: 'preparando', hasta: 'listo' }
    ],
    camarero: [
        { desde: 'listo', hasta: 'entregado' }
    ],
    cliente: []
}

export function puedeTransicionar(rol: EmployeeRoleType, desde: OrderStatusType, hasta: OrderStatusType): boolean {
    return TRANSICIONES_POR_ROL[rol].some(t => t.desde === desde && t.hasta === hasta)
}
