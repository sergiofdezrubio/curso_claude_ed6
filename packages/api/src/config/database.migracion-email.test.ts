import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Database } from '@config/database.js'

const INDICE = 'idx_employees_email_nocase'

async function insertarEmpleado(db: Database, id: string, email: string) {
    await db.run(
        'INSERT INTO employees (id, first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
        [id, 'Nombre', 'Apellido', email, 'hash', 'cliente']
    )
}

async function existeIndice(db: Database): Promise<boolean> {
    const fila = await db.get<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        [INDICE]
    )
    return fila !== undefined
}

describe('Migración de emails únicos sin distinguir mayúsculas', () => {
    let db: Database

    beforeEach(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
    })

    afterEach(async () => {
        vi.restoreAllMocks()
        await db.close()
    })

    it('en una BD nueva crea el índice y rechaza un duplicado que solo difiere en mayúsculas', async () => {
        expect(await existeIndice(db)).toBe(true)
        await insertarEmpleado(db, 'e1', 'admin@resttek.com')
        await expect(insertarEmpleado(db, 'e2', 'ADMIN@resttek.com')).rejects.toThrow(/UNIQUE/)
    })

    it('pasa a minúsculas los emails existentes y crea el índice', async () => {
        // Simula una BD heredada: sin índice y con emails en mayúsculas
        await db.run(`DROP INDEX ${INDICE}`)
        await insertarEmpleado(db, 'e1', 'Admin@Resttek.com')
        await insertarEmpleado(db, 'e2', 'otro@resttek.com')

        await db.migrateEmailsNocase()

        const filas = await db.all<{ id: string; email: string }>('SELECT id, email FROM employees ORDER BY id')
        expect(filas.map(f => f.email)).toEqual(['admin@resttek.com', 'otro@resttek.com'])
        expect(await existeIndice(db)).toBe(true)
        await expect(insertarEmpleado(db, 'e3', 'ADMIN@RESTTEK.COM')).rejects.toThrow(/UNIQUE/)
    })

    it('es idempotente: ejecutarla varias veces no falla ni cambia datos', async () => {
        await insertarEmpleado(db, 'e1', 'admin@resttek.com')
        await db.migrateEmailsNocase()
        await db.migrateEmailsNocase()
        const filas = await db.all<{ email: string }>('SELECT email FROM employees')
        expect(filas).toEqual([{ email: 'admin@resttek.com' }])
        expect(await existeIndice(db)).toBe(true)
    })

    it('con duplicados preexistentes no falla, no toca datos, no crea el índice y avisa', async () => {
        await db.run(`DROP INDEX ${INDICE}`)
        await insertarEmpleado(db, 'e1', 'Dup@Resttek.com')
        await insertarEmpleado(db, 'e2', 'dup@resttek.com')
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await expect(db.migrateEmailsNocase()).resolves.toBeUndefined()

        const filas = await db.all<{ email: string }>('SELECT email FROM employees ORDER BY id')
        expect(filas.map(f => f.email)).toEqual(['Dup@Resttek.com', 'dup@resttek.com'])
        expect(await existeIndice(db)).toBe(false)
        expect(aviso).toHaveBeenCalledTimes(1)
        expect(String(aviso.mock.calls[0]?.[0])).toContain('dup@resttek.com')
    })
})
