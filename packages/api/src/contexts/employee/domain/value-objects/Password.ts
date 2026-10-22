import { InvalidPasswordError } from '@errors/DomainErrors.js'

const MIN_BYTES = 10
// bcrypt ignora todo lo que supere los 72 bytes
const MAX_BYTES = 72

export class Password {
    private constructor(private readonly _value: string) {}

    static create(value: unknown): Password {
        if (typeof value !== 'string') {
            throw new InvalidPasswordError('La contraseña debe ser un texto')
        }

        const bytes = Buffer.byteLength(value, 'utf8')
        if (bytes < MIN_BYTES) {
            throw new InvalidPasswordError(`La contraseña debe tener al menos ${MIN_BYTES} bytes`)
        }
        if (bytes > MAX_BYTES) {
            throw new InvalidPasswordError(`La contraseña no puede tener más de ${MAX_BYTES} bytes`)
        }

        return new Password(value)
    }

    get value(): string {
        return this._value
    }
}
