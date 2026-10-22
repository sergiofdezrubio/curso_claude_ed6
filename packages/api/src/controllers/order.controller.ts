import type { Request, Response } from 'express'
import type { OrderService } from '@services/order.service.js'
import type { AuthRequest } from '@shared/infrastructure/http/middlewares.js'

export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    async createOrder(req: Request, res: Response): Promise<void> {
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
            if (error instanceof Error) {
                res.status(400).json({ error: error.message })
            } else {
                res.status(500).json({ error: 'Internal Server Error' })
            }
        }
    }

    async getActiveOrders(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const { restaurantId } = req.query
            if (!restaurantId || typeof restaurantId !== 'string') {
                res.status(400).json({ error: 'restaurantId is required' })
                return
            }

            const orders = await this.orderService.listActive(restaurantId, user)
            res.status(200).json(orders)
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    async getMyOrders(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const orders = await this.orderService.listMine(user)
            res.status(200).json(orders)
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    async getById(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as AuthRequest).user
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' })
                return
            }
            const order = await this.orderService.getById(req.params.id as string, user)
            res.status(200).json(order)
        } catch (error) {
            if (error instanceof Error && error.name === 'OrderNotFoundError') {
                res.status(404).json({ error: error.message })
            } else {
                res.status(500).json({ error: 'Internal Server Error' })
            }
        }
    }

    async updateItemStatus(req: Request, res: Response): Promise<void> {
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
            if (error instanceof Error && (error.name === 'OrderNotFoundError' || error.name === 'InvalidOrderStatusError')) {
                res.status(400).json({ error: error.message })
            } else {
                res.status(500).json({ error: 'Internal Server Error' })
            }
        }
    }
}
