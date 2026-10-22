import { Email } from '@shared/domain/value-objects/Email.js'
import { InvalidEmailError } from '@errors/DomainErrors.js'
import { describe, it, expect } from 'vitest'

describe('Email Value Object', () => {
    it('debe crear un email válido', () => {
        const email = new Email('john@resttek.com')
        expect(email.getValue()).toBe('john@resttek.com')
    })

    it('debe normalizar el email a minúsculas', () => {
        const email = new Email('Admin@Resttek.com')
        expect(email.getValue()).toBe('admin@resttek.com')
    })

    it('debe eliminar los espacios alrededor del email', () => {
        const email = new Email('  Admin@Resttek.com ')
        expect(email.getValue()).toBe('admin@resttek.com')
    })

    it('debe rechazar un email inválido aunque tenga espacios o mayúsculas', () => {
        expect(() => new Email('  NoEsUnEmail  ')).toThrow(InvalidEmailError)
    })

    it('debe rechazar un email vacío', () => {
        expect(() => new Email('   ')).toThrow(InvalidEmailError)
    })
})
