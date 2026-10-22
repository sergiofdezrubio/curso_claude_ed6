import type { Request, Response, NextFunction } from 'express'
import type { OrderService } from '@services/order.service.js'
import type { AuthRequest, AuthUser } from '@shared/infrastructure/http/middlewares.js'
import { ForbiddenActionError, RestaurantIdRequiredError } from '@errors/DomainErrors.js'

// Resuelve el restaurante a consultar: el del token, salvo el admin, que puede indicarlo por query.
function resolverRestaurantId(user: AuthUser, restaurantIdQuery: unknown): string {
    const consulta = typeof restaurantIdQuery === 'string' && restaurantIdQuery !== ''
        ? restaurantIdQuery
        : undefined

    if (user.role === 'admin') {
        const restaurantId = consulta ?? user.restaurantId
        if (!restaurantId) throw new RestaurantIdRequiredError()
        return restaurantId
    }

    if (!user.restaurantId) throw new ForbiddenActionError()
    if (consulta !== undefined && consulta !== user.restaurantId) throw new ForbiddenActionError()
    return user.restaurantId
}

export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const { restaurantId, tableId, items } = req.body
            const order = await this.orderService.create({
                restaurantId,
                tableId: tableId ?? null,
                items
            }, user)
            res.status(201).json(order)
        } catch (error) {
            next(error)
        }
    }

    async getActiveOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const restaurantId = resolverRestaurantId(user, req.query.restaurantId)
            const orders = await this.orderService.listActive(restaurantId, user)
            res.status(200).json(orders)
        } catch (error) {
            next(error)
        }
    }

    async getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const orders = await this.orderService.listMine(user)
            res.status(200).json(orders)
        } catch (error) {
            next(error)
        }
    }

    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const order = await this.orderService.getById(req.params.id as string, user)
            res.status(200).json(order)
        } catch (error) {
            next(error)
        }
    }

    async updateItemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const orderId = req.params.orderId as string
            const itemId = req.params.itemId as string
            const { status } = req.body

            await this.orderService.updateItemStatus(orderId, itemId, status, user)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }
}
