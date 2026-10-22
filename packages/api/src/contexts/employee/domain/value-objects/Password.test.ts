import { Password } from '@employee/domain/value-objects/Password.js'
import { InvalidPasswordError } from '@errors/DomainErrors.js'
import { describe, it, expect } from 'vitest'

describe('Password Value Object', () => {
    it('debe crear una contraseña válida', () => {
        const password = Password.create('ContraseñaSegura1')
        expect(password.value).toBe('ContraseñaSegura1')
    })

    it('debe rechazar una cadena vacía', () => {
        expect(() => Password.create('')).toThrow(InvalidPasswordError)
    })

    it.each([undefined, null, 1234567890, {}])('debe rechazar un valor que no es string (%s)', (valor) => {
        expect(() => Password.create(valor as unknown as string)).toThrow('La contraseña debe ser un texto')
    })

    it('debe rechazar 9 caracteres', () => {
        expect(() => Password.create('a'.repeat(9))).toThrow('al menos 10')
    })

    it('debe aceptar 10 caracteres', () => {
        expect(Password.create('a'.repeat(10)).value).toBe('a'.repeat(10))
    })

    it('debe aceptar 72 bytes', () => {
        expect(Password.create('a'.repeat(72)).value).toHaveLength(72)
    })

    it('debe rechazar 73 bytes', () => {
        expect(() => Password.create('a'.repeat(73))).toThrow('más de 72 bytes')
    })

    it('debe contar bytes y no caracteres (37 «é» = 74 bytes)', () => {
        expect(() => Password.create('é'.repeat(37))).toThrow(InvalidPasswordError)
    })

    it('debe aceptar 36 «é» (72 bytes)', () => {
        expect(Password.create('é'.repeat(36)).value).toBe('é'.repeat(36))
    })
})
