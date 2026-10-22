import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import type { Order, OrderItem } from '@models/order.model.js'
import { OrderNotFoundError, InvalidOrderStatusError, InvalidOrderItemsError, ForbiddenActionError } from '@errors/DomainErrors.js'
import type { AuthUser } from '@shared/infrastructure/http/middlewares.js'

const admin: AuthUser = { id: 'admin-1', role: 'admin', restaurantId: null }

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
        await service.updateItemStatus('order-1', 'item-1', 'preparando', admin)
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando', admin))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando', admin))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status', admin))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService.create (validación de items)', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const crear = (quantity: unknown) => service.create({
        restaurantId: 'rest-1',
        tableId: null,
        items: [{ dishId: 'dish-1', quantity: quantity as number, notes: null }]
    }, admin)

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
        await expect(service.create({ restaurantId: 'rest-1', tableId: null, items: [] }, admin))
            .rejects.toThrow(InvalidOrderItemsError)
    })

    it('debe rechazar items que no es un array', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: null, items: 'x' as never }, admin))
            .rejects.toThrow(InvalidOrderItemsError)
    })

    it('debe rechazar un pedido con 31 líneas', async () => {
        await expect(service.create({ restaurantId: 'rest-1', tableId: null, items: lineas(31) }, admin))
            .rejects.toThrow(InvalidOrderItemsError)
        expect(repo.orders).toHaveLength(0)
    })

    it.each(['', '   ', 5, null, undefined])('debe rechazar dishId %j', async (dishId) => {
        await expect(service.create({
            restaurantId: 'rest-1',
            tableId: null,
            items: [{ dishId: dishId as string, quantity: 1, notes: null }]
        }, admin)).rejects.toThrow(InvalidOrderItemsError)
        expect(repo.orders).toHaveLength(0)
    })

    it('debe crear un pedido válido', async () => {
        const order = await crear(2)
        expect(order.items).toHaveLength(2)
        expect(repo.orders).toHaveLength(1)
    })

    it('debe aceptar el límite de 30 líneas', async () => {
        const order = await service.create({ restaurantId: 'rest-1', tableId: null, items: lineas(30) }, admin)
        expect(order.items).toHaveLength(30)
    })

    it('debe aceptar quantity 50', async () => {
        const order = await crear(50)
        expect(order.items).toHaveLength(50)
    })
})

describe('OrderService (pertenencia)', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const camareroRest1: AuthUser = { id: 'cam-1', role: 'camarero', restaurantId: 'rest-1' }
    const managerRest2: AuthUser = { id: 'man-2', role: 'manager', restaurantId: 'rest-2' }
    const cliente: AuthUser = { id: 'cli-1', role: 'cliente', restaurantId: null }

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
        await repo.create({
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: 'cli-otro',
            createdAt: new Date(),
            items: [{ id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }]
        })
    })

    it('un usuario de otro restaurante no puede obtener el pedido', async () => {
        await expect(service.getById('order-1', managerRest2)).rejects.toThrow(OrderNotFoundError)
    })

    it('un usuario de otro restaurante no puede modificar el pedido', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'preparando', managerRest2))
            .rejects.toThrow(OrderNotFoundError)
        expect(repo.orders[0]!.items[0]!.status).toBe('pendiente')
    })

    it('el personal del mismo restaurante sí puede obtener el pedido', async () => {
        const order = await service.getById('order-1', camareroRest1)
        expect(order.id).toBe('order-1')
    })

    it('un cliente no puede obtener un pedido ajeno', async () => {
        await expect(service.getById('order-1', cliente)).rejects.toThrow(OrderNotFoundError)
    })

    it('no se pueden listar los pedidos activos de otro restaurante', async () => {
        await expect(service.listActive('rest-1', managerRest2)).rejects.toThrow(ForbiddenActionError)
    })

    it('el personal no puede crear pedidos en otro restaurante', async () => {
        await expect(service.create({
            restaurantId: 'rest-1',
            tableId: null,
            items: [{ dishId: 'dish-1', quantity: 1, notes: null }]
        }, managerRest2)).rejects.toThrow(ForbiddenActionError)
    })

    it('el clientId del pedido creado es siempre el del usuario autenticado', async () => {
        const order = await service.create({
            restaurantId: 'rest-1',
            tableId: null,
            clientId: 'cli-otro',
            items: [{ dishId: 'dish-1', quantity: 1, notes: null }]
        } as never, cliente)
        expect(order.clientId).toBe('cli-1')
    })
})

describe('OrderService.updateItemStatus (transiciones por rol)', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const cocinero: AuthUser = { id: 'coc-1', role: 'cocinero', restaurantId: 'rest-1' }
    const camarero: AuthUser = { id: 'cam-1', role: 'camarero', restaurantId: 'rest-1' }

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
        await repo.create({
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            createdAt: new Date(),
            items: [{ id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'listo' }]
        })
    })

    it('un cocinero no puede marcar un item como entregado', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'entregado', cocinero))
            .rejects.toThrow(ForbiddenActionError)
        expect(repo.orders[0]!.items[0]!.status).toBe('listo')
    })

    it('un camarero no puede marcar un item como preparando', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'preparando', camarero))
            .rejects.toThrow(ForbiddenActionError)
        expect(repo.orders[0]!.items[0]!.status).toBe('listo')
    })

    it('un camarero puede marcar como entregado un item listo', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'entregado', camarero)
        expect(repo.orders[0]!.items[0]!.status).toBe('entregado')
    })
})

const usuario = (role: AuthUser['role'], restaurantId: string | null, id = `${role}-${restaurantId ?? 'sin'}`): AuthUser =>
    ({ id, role, restaurantId })

const pedido = (id: string, restaurantId: string, clientId: string | null, estado: OrderItem['status'] = 'pendiente'): Order => ({
    id,
    restaurantId,
    tableId: null,
    clientId,
    createdAt: new Date(),
    items: [{ id: `${id}-item`, dishId: 'dish-1', quantity: 1, notes: null, status: estado }]
})

describe('OrderService (autorización de lectura)', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const personal = ['manager', 'camarero', 'cocinero'] as const
    const dueno = usuario('cliente', null, 'cli-1')
    const clienteAjeno = usuario('cliente', null, 'cli-2')

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
        await repo.create(pedido('p-r1', 'rest-1', 'cli-1'))
        await repo.create(pedido('p-r2', 'rest-2', 'cli-2'))
    })

    describe('getById', () => {
        it('admin accede a pedidos de cualquier restaurante', async () => {
            expect((await service.getById('p-r1', admin)).id).toBe('p-r1')
            expect((await service.getById('p-r2', admin)).id).toBe('p-r2')
        })

        it.each(personal)('%s del mismo restaurante accede al pedido', async (rol) => {
            expect((await service.getById('p-r1', usuario(rol, 'rest-1'))).id).toBe('p-r1')
        })

        it.each(personal)('%s de otro restaurante recibe OrderNotFoundError', async (rol) => {
            await expect(service.getById('p-r1', usuario(rol, 'rest-2'))).rejects.toThrow(OrderNotFoundError)
        })

        it.each(personal)('%s sin restaurante (null) no accede a nada', async (rol) => {
            await expect(service.getById('p-r1', usuario(rol, null))).rejects.toThrow(OrderNotFoundError)
        })

        it('el cliente dueño accede a su pedido', async () => {
            expect((await service.getById('p-r1', dueno)).id).toBe('p-r1')
        })

        it('un cliente ajeno recibe OrderNotFoundError', async () => {
            await expect(service.getById('p-r1', clienteAjeno)).rejects.toThrow(OrderNotFoundError)
        })

        it('un pedido inexistente y uno ajeno dan el mismo error', async () => {
            await expect(service.getById('no-existe', clienteAjeno)).rejects.toThrow(OrderNotFoundError)
        })
    })

    describe('listActive', () => {
        it('admin lista los activos de cualquier restaurante', async () => {
            expect((await service.listActive('rest-1', admin)).map(o => o.id)).toEqual(['p-r1'])
            expect((await service.listActive('rest-2', admin)).map(o => o.id)).toEqual(['p-r2'])
        })

        it.each(personal)('%s lista los activos de su restaurante', async (rol) => {
            expect((await service.listActive('rest-1', usuario(rol, 'rest-1'))).map(o => o.id)).toEqual(['p-r1'])
        })

        it.each(personal)('%s no lista los activos de otro restaurante', async (rol) => {
            await expect(service.listActive('rest-1', usuario(rol, 'rest-2'))).rejects.toThrow(ForbiddenActionError)
        })

        it.each(personal)('%s sin restaurante (null) no lista nada', async (rol) => {
            await expect(service.listActive('rest-1', usuario(rol, null))).rejects.toThrow(ForbiddenActionError)
        })

        it('un cliente no puede listar los activos', async () => {
            await expect(service.listActive('rest-1', dueno)).rejects.toThrow(ForbiddenActionError)
        })
    })

    describe('listMine', () => {
        it('el cliente solo ve sus propios pedidos', async () => {
            expect((await service.listMine(dueno)).map(o => o.id)).toEqual(['p-r1'])
            expect((await service.listMine(clienteAjeno)).map(o => o.id)).toEqual(['p-r2'])
        })

        it('un cliente sin pedidos recibe una lista vacía', async () => {
            expect(await service.listMine(usuario('cliente', null, 'cli-3'))).toEqual([])
        })
    })
})

describe('OrderService.create (autorización)', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const peticion = (restaurantId: string) => ({
        restaurantId,
        tableId: null,
        items: [{ dishId: 'dish-1', quantity: 1, notes: null }]
    })

    beforeEach(() => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
    })

    it('admin crea en cualquier restaurante con su propio id como clientId', async () => {
        const order = await service.create(peticion('rest-9'), admin)
        expect(order.clientId).toBe('admin-1')
    })

    it.each(['manager', 'camarero', 'cocinero'] as const)('%s crea en su restaurante con su id como clientId', async (rol) => {
        const user = usuario(rol, 'rest-1', `${rol}-id`)
        const order = await service.create(peticion('rest-1'), user)
        expect(order.clientId).toBe(`${rol}-id`)
    })

    it.each(['manager', 'camarero', 'cocinero'] as const)('%s no crea en otro restaurante', async (rol) => {
        await expect(service.create(peticion('rest-1'), usuario(rol, 'rest-2'))).rejects.toThrow(ForbiddenActionError)
        expect(repo.orders).toHaveLength(0)
    })

    it.each(['manager', 'camarero', 'cocinero'] as const)('%s sin restaurante (null) no crea pedidos', async (rol) => {
        await expect(service.create(peticion('rest-1'), usuario(rol, null))).rejects.toThrow(ForbiddenActionError)
        expect(repo.orders).toHaveLength(0)
    })

    it('un cliente crea en cualquier restaurante y el clientId es el suyo', async () => {
        const order = await service.create({ ...peticion('rest-7'), clientId: 'suplantado' } as never, usuario('cliente', null, 'cli-1'))
        expect(order.clientId).toBe('cli-1')
        expect(repo.orders[0]!.clientId).toBe('cli-1')
    })
})

describe('OrderService.updateItemStatus (autorización de pertenencia)', () => {
    let repo: MockOrderRepository
    let service: OrderService

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
        await repo.create(pedido('p-r1', 'rest-1', 'cli-1'))
    })

    const estado = () => repo.orders[0]!.items[0]!.status

    it('admin cambia el estado en cualquier restaurante', async () => {
        await service.updateItemStatus('p-r1', 'p-r1-item', 'entregado', admin)
        expect(estado()).toBe('entregado')
    })

    it('el cocinero del mismo restaurante cambia el estado', async () => {
        await service.updateItemStatus('p-r1', 'p-r1-item', 'preparando', usuario('cocinero', 'rest-1'))
        expect(estado()).toBe('preparando')
    })

    it.each(['manager', 'camarero', 'cocinero'] as const)('%s de otro restaurante recibe OrderNotFoundError y no modifica nada', async (rol) => {
        await expect(service.updateItemStatus('p-r1', 'p-r1-item', 'preparando', usuario(rol, 'rest-2')))
            .rejects.toThrow(OrderNotFoundError)
        expect(estado()).toBe('pendiente')
    })

    it.each(['manager', 'camarero', 'cocinero'] as const)('%s sin restaurante (null) recibe OrderNotFoundError', async (rol) => {
        await expect(service.updateItemStatus('p-r1', 'p-r1-item', 'preparando', usuario(rol, null)))
            .rejects.toThrow(OrderNotFoundError)
        expect(estado()).toBe('pendiente')
    })

    it('un cliente dueño del pedido no puede cambiar el estado (403)', async () => {
        await expect(service.updateItemStatus('p-r1', 'p-r1-item', 'preparando', usuario('cliente', null, 'cli-1')))
            .rejects.toThrow(ForbiddenActionError)
        expect(estado()).toBe('pendiente')
    })

    it('un cliente ajeno recibe OrderNotFoundError', async () => {
        await expect(service.updateItemStatus('p-r1', 'p-r1-item', 'preparando', usuario('cliente', null, 'cli-2')))
            .rejects.toThrow(OrderNotFoundError)
    })
})

describe('OrderService.updateItemStatus (matriz rol × transición)', () => {
    type Estado = OrderItem['status']
    type Resultado = 'permitida' | 'prohibida'

    const estados: Estado[] = ['pendiente', 'preparando', 'listo', 'entregado']

    // Matriz escrita a mano (no derivada del modelo): transiciones permitidas por rol.
    const permitidas: Record<AuthUser['role'], string[]> = {
        admin: estados.flatMap(d => estados.filter(h => h !== d).map(h => `${d}>${h}`)),
        manager: estados.flatMap(d => estados.filter(h => h !== d).map(h => `${d}>${h}`)),
        cocinero: ['pendiente>preparando', 'preparando>listo'],
        camarero: ['listo>entregado'],
        cliente: []
    }

    const roles = Object.keys(permitidas) as AuthUser['role'][]
    const casos = roles.flatMap(rol => estados.flatMap(desde => estados.map(hasta => ({
        rol,
        desde,
        hasta,
        esperado: (permitidas[rol].includes(`${desde}>${hasta}`) ? 'permitida' : 'prohibida') as Resultado
    }))))

    const preparar = async (desde: Estado): Promise<{ repo: MockOrderRepository, service: OrderService }> => {
        const repo = new MockOrderRepository()
        // El cliente es dueño del pedido para que llegue a la comprobación de la transición.
        await repo.create(pedido('p-1', 'rest-1', 'user-1', desde))
        return { repo, service: new OrderService(repo) }
    }

    it.each(casos)('$rol: $desde → $hasta es $esperado', async ({ rol, desde, hasta, esperado }) => {
        const { repo, service } = await preparar(desde)
        const user = usuario(rol, rol === 'admin' || rol === 'cliente' ? null : 'rest-1', 'user-1')
        const llamada = service.updateItemStatus('p-1', 'p-1-item', hasta, user)

        if (esperado === 'permitida') {
            await expect(llamada).resolves.toBeUndefined()
            expect(repo.orders[0]!.items[0]!.status).toBe(hasta)
        } else {
            await expect(llamada).rejects.toThrow(ForbiddenActionError)
            expect(repo.orders[0]!.items[0]!.status).toBe(desde)
        }
    })

    it.each(roles)('%s: un estado inexistente da InvalidOrderStatusError (400)', async (rol) => {
        const { repo, service } = await preparar('pendiente')
        const user = usuario(rol, rol === 'admin' || rol === 'cliente' ? null : 'rest-1', 'user-1')
        await expect(service.updateItemStatus('p-1', 'p-1-item', 'cancelado', user))
            .rejects.toThrow(InvalidOrderStatusError)
        expect(repo.orders[0]!.items[0]!.status).toBe('pendiente')
    })

    it.each([
        ['cocinero', 'pendiente', 'listo'],
        ['cocinero', 'listo', 'preparando'],
        ['camarero', 'pendiente', 'entregado'],
        ['camarero', 'entregado', 'listo']
    ] as const)('%s no puede saltar pasos ni retroceder (%s → %s)', async (rol, desde, hasta) => {
        const { service } = await preparar(desde)
        await expect(service.updateItemStatus('p-1', 'p-1-item', hasta, usuario(rol, 'rest-1')))
            .rejects.toThrow(ForbiddenActionError)
    })
})
