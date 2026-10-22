import { InvalidEmailError } from '@errors/DomainErrors.js'

export class Email {
    private readonly value: string

    constructor(value: string) {
        // Normalizamos antes de validar y guardar: sin espacios y en minúsculas
        const normalized = value.trim().toLowerCase()
        if (!this.isValid(normalized)) {
            throw new InvalidEmailError()
        }
        this.value = normalized
    }

    private isValid(email: string): boolean {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return regex.test(email)
    }

    public getValue(): string {
        return this.value
    }
}
