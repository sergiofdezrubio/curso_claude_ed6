import { randomUUID } from 'crypto'
import { dbConfig } from '@config/database.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import { SqliteEmployeeRepository } from '@employee/infrastructure/SqliteEmployeeRepository.js'
import { Employee } from '@employee/domain/Employee.js'

const seed = async () => {
    try {
        await dbConfig.initialize()
        console.log('Database initialized.')

        const authService = new BcryptAuthService()
        const employeeRepo = new SqliteEmployeeRepository(dbConfig)

        const admin = await employeeRepo.findByEmail('admin@resttek.com')
        if (!admin) {
            const adminEmployee = Employee.create({
                id: randomUUID(),
                firstName: 'Admin',
                lastName: 'RestTek',
                email: 'admin@resttek.com',
                passwordHash: await authService.hashPassword('admin@resttek.com'),
                role: 'admin',
                restaurantId: null
            })
            await employeeRepo.save(adminEmployee)
            console.log('Admin created: admin@resttek.com / admin@resttek.com')
        } else {
            console.log('Admin already exists.')
        }

        // Los restaurantes van antes que los empleados: employees.restaurant_id es una FK
        await dbConfig.run(`
            INSERT OR IGNORE INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['rest-1', 'Restaurante El Gourmet', 'Calle Mayor 10, Madrid', 'info@gourmet.com', '912345678', 'Carlos', 'García', new Date().toISOString(), new Date().toISOString()])

        await dbConfig.run(`
            INSERT OR IGNORE INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['rest-2', 'Pizzería Napoli', 'Avenida del Sol 25, Barcelona', 'info@napoli.com', '934567890', 'Marco', 'Rossi', new Date().toISOString(), new Date().toISOString()])

        console.log('Restaurants created.')

        const employees = [
            { firstName: 'Juan', lastName: 'García', email: 'cocinero1@resttek.com', role: 'cocinero', restaurantId: 'rest-1' },
            { firstName: 'María', lastName: 'López', email: 'camarero1@resttek.com', role: 'camarero', restaurantId: 'rest-1' },
            { firstName: 'Pedro', lastName: 'Martínez', email: 'camarero2@resttek.com', role: 'camarero', restaurantId: 'rest-1' },
            { firstName: 'Roberto', lastName: 'Díaz', email: 'gerente1@resttek.com', role: 'manager', restaurantId: 'rest-1' },
            { firstName: 'Carlos', lastName: 'Sánchez', email: 'cocinero2@resttek.com', role: 'cocinero', restaurantId: 'rest-2' },
            { firstName: 'Ana', lastName: 'Fernández', email: 'camarero3@resttek.com', role: 'camarero', restaurantId: 'rest-2' },
            { firstName: 'Sofia', lastName: 'Rossi', email: 'gerente2@resttek.com', role: 'manager', restaurantId: 'rest-2' },
            { firstName: 'Laura', lastName: 'Gómez', email: 'cliente1@resttek.com', role: 'cliente', restaurantId: null },
            { firstName: 'Pablo', lastName: 'Ruiz', email: 'cliente2@resttek.com', role: 'cliente', restaurantId: null },
        ]

        for (const emp of employees) {
            if (!await employeeRepo.findByEmail(emp.email)) {
                const employee = Employee.create({
                    id: randomUUID(),
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    email: emp.email,
                    passwordHash: await authService.hashPassword(emp.email),
                    role: emp.role,
                    restaurantId: emp.restaurantId
                })
                await employeeRepo.save(employee)
                console.log(`${emp.role} created: ${emp.email} / ${emp.email}`)
            } else {
                console.log(`${emp.role} already exists: ${emp.email}`)
            }
        }

        // Ids estables y reutilización por nombre: el seed es idempotente y no duplica datos
        // aunque la BD ya contenga filas de ejecuciones anteriores.
        const asegurarIngrediente = async (id: string, name: string, unit: string, stock: number, restaurantId: string): Promise<string> => {
            const existente = await dbConfig.get<{ id: string }>('SELECT id FROM ingredients WHERE name = ? AND restaurant_id = ?', [name, restaurantId])
            if (existente) return existente.id
            await dbConfig.run(`
                INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, restaurant_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [id, name, unit, stock, restaurantId, new Date().toISOString(), new Date().toISOString()])
            return id
        }

        const asegurarPlato = async (id: string, name: string, description: string, price: number, category: string, restaurantId: string): Promise<string> => {
            const existente = await dbConfig.get<{ id: string }>('SELECT id FROM dishes WHERE name = ? AND restaurant_id = ?', [name, restaurantId])
            if (existente) return existente.id
            await dbConfig.run(`
                INSERT OR IGNORE INTO dishes (id, name, description, price, category, restaurant_id, available, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [id, name, description, price, category, restaurantId, 1, new Date().toISOString(), new Date().toISOString()])
            return id
        }

        const asegurarIngredientePlato = (dishId: string, ingredientId: string, quantity: number) =>
            dbConfig.run('INSERT OR IGNORE INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?, ?, ?)', [dishId, ingredientId, quantity])

        const tomate = await asegurarIngrediente('seed-ing-rest1-tomate', 'Tomate', 'kg', 10, 'rest-1')
        const mozzarella = await asegurarIngrediente('seed-ing-rest1-mozzarella', 'Queso mozzarella', 'kg', 10, 'rest-1')
        const aceite = await asegurarIngrediente('seed-ing-rest1-aceite', 'Aceite de oliva', 'L', 10, 'rest-1')
        const ajo = await asegurarIngrediente('seed-ing-rest1-ajo', 'Ajo', 'kg', 10, 'rest-1')
        const albahaca = await asegurarIngrediente('seed-ing-rest1-albahaca', 'Albahaca', 'kg', 10, 'rest-1')

        const dish1Id = await asegurarPlato('seed-dish-rest1-margarita', 'Pizza Margarita', 'Pizza clásica con tomate, mozzarella y albahaca', 12.50, 'principal', 'rest-1')
        await asegurarIngredientePlato(dish1Id, tomate, 0.3)
        await asegurarIngredientePlato(dish1Id, mozzarella, 0.4)
        await asegurarIngredientePlato(dish1Id, albahaca, 0.05)

        const dish2Id = await asegurarPlato('seed-dish-rest1-caprese', 'Ensalada Caprese', 'Ensalada fresca con tomate, mozzarella y albahaca', 9.00, 'entrante', 'rest-1')
        await asegurarIngredientePlato(dish2Id, tomate, 0.4)
        await asegurarIngredientePlato(dish2Id, mozzarella, 0.3)
        await asegurarIngredientePlato(dish2Id, albahaca, 0.03)

        const dish3Id = await asegurarPlato('seed-dish-rest1-bruschetta', 'Bruschetta', 'Pan tostado con tomate, ajo y aceite de oliva', 7.50, 'entrante', 'rest-1')
        await asegurarIngredientePlato(dish3Id, tomate, 0.2)
        await asegurarIngredientePlato(dish3Id, aceite, 0.05)
        await asegurarIngredientePlato(dish3Id, ajo, 0.01)

        const drink1Id = await asegurarPlato('seed-dish-rest1-cola', 'Refresco de Cola', 'Bebida refrescante', 2.50, 'bebida', 'rest-1')
        const drink2Id = await asegurarPlato('seed-dish-rest1-agua', 'Agua Mineral', 'Agua mineral natural', 2.00, 'bebida', 'rest-1')

        console.log('Restaurant 1 dishes created: 3 dishes + 2 drinks')

        const harina = await asegurarIngrediente('seed-ing-rest2-harina', 'Harina', 'kg', 15, 'rest-2')
        const levadura = await asegurarIngrediente('seed-ing-rest2-levadura', 'Levadura', 'kg', 15, 'rest-2')
        const tomateTriturado = await asegurarIngrediente('seed-ing-rest2-tomate-triturado', 'Tomate triturado', 'kg', 15, 'rest-2')

        const dishNapoliId = await asegurarPlato('seed-dish-rest2-napolitana', 'Pizza Napolitana', 'Pizza al estilo napolitano con tomate y mozzarella', 14.00, 'principal', 'rest-2')
        await asegurarIngredientePlato(dishNapoliId, harina, 0.5)
        await asegurarIngredientePlato(dishNapoliId, levadura, 0.02)
        await asegurarIngredientePlato(dishNapoliId, tomateTriturado, 0.3)

        await asegurarPlato('seed-dish-rest2-limonada', 'Limonada Casera', 'Limonada recién hecha', 3.50, 'bebida', 'rest-2')

        console.log('Restaurant 2 dishes created: 1 dish + 1 drink')

        const order1Id = 'seed-order-1'
        // Los pedidos no tienen un nombre único: si ya hay uno de ejemplo para esa mesa (de esta u otra ejecución), no se crea otro
        const pedidoExistente = await dbConfig.get<{ id: string }>(
            'SELECT id FROM orders WHERE id = ? OR (restaurant_id = ? AND table_id = ? AND client_id IS NULL)',
            [order1Id, 'rest-1', '5']
        )

        if (!pedidoExistente) {
            await dbConfig.run(`
                INSERT INTO orders (id, restaurant_id, table_id, client_id, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [order1Id, 'rest-1', '5', null, new Date().toISOString()])

            const lineas: Array<[string, string, number, string | null, string]> = [
                ['seed-order-1-item-1', dish1Id, 1, null, 'pendiente'],
                ['seed-order-1-item-2', dish1Id, 1, null, 'pendiente'],
                ['seed-order-1-item-3', dish2Id, 1, 'Sin cebolla', 'pendiente'],
                ['seed-order-1-item-4', dish2Id, 1, 'Sin cebolla', 'pendiente'],
                ['seed-order-1-item-5', dish2Id, 1, 'Sin cebolla', 'pendiente'],
                ['seed-order-1-item-6', dish3Id, 1, null, 'preparando'],
                ['seed-order-1-item-7', drink1Id, 1, null, 'pendiente'],
                ['seed-order-1-item-8', drink2Id, 2, null, 'pendiente'],
            ]
            for (const [id, dishId, quantity, notes, status] of lineas) {
                await dbConfig.run(`
                    INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [id, order1Id, dishId, quantity, notes, status])
            }
        }

        console.log('Sample orders created')

        console.log('\n=== Seed completado ===')
        console.log('\nEmpleados:')
        console.log('  Admin: admin@resttek.com / admin@resttek.com')
        console.log('  Cocinero: cocinero1@resttek.com / cocinero1@resttek.com')
        console.log('  Camarero: camarero1@resttek.com / camarero1@resttek.com')
        console.log('  Camarero: camarero2@resttek.com / camarero2@resttek.com')
        console.log('  Gerente: gerente1@resttek.com / gerente1@resttek.com')
        console.log('  Cocinero: cocinero2@resttek.com / cocinero2@resttek.com')
        console.log('  Camarero: camarero3@resttek.com / camarero3@resttek.com')
        console.log('  Gerente: gerente2@resttek.com / gerente2@resttek.com')
        console.log('\nClientes:')
        console.log('  cliente1@resttek.com / cliente1@resttek.com')
        console.log('  cliente2@resttek.com / cliente2@resttek.com')

        await dbConfig.close()
    } catch (error) {
        console.error('Seed failed:', error)
        process.exit(1)
    }
}

seed()
