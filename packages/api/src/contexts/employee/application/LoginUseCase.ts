import type { IEmployeeRepository } from '@employee/domain/IEmployeeRepository.js'
import type { IAuthService } from '@employee/domain/IAuthService.js'
import { Email } from '@shared/domain/value-objects/Email.js'
import { InvalidCredentialsError, InvalidEmailError } from '@errors/DomainErrors.js'

// Hash bcrypt ficticio (coste 12, igual que SALT_ROUNDS de BcryptAuthService), precalculado
// sobre una cadena aleatoria que no es ninguna contraseña real. Se usa para igualar los tiempos
// de respuesta cuando el email no existe (API-H6).
const DUMMY_PASSWORD_HASH = '$2b$12$.DTAlFbjLXysgrHH0rxF5O9/Mz5Oa6JQfXI7ZLqwd1TeVEpH0w4sK'

export interface LoginDTO {
    email: string
    passwordRaw: string
}

export interface LoginResponse {
    token: string
    employee: {
        id: string
        firstName: string
        lastName: string
        email: string
        role: string
        restaurantId: string | null
    }
}

export class LoginUseCase {
    constructor(
        private employeeRepository: IEmployeeRepository,
        private authService: IAuthService
    ) {}

    async execute(dto: LoginDTO): Promise<LoginResponse> {
        // Un email con formato inválido no puede existir: se trata como "no encontrado" (mismo error genérico)
        let employee = null
        try {
            employee = await this.employeeRepository.findByEmail(new Email(dto.email).getValue())
        } catch (error) {
            if (!(error instanceof InvalidEmailError)) throw error
        }

        // Siempre se ejecuta una única comparación, exista o no el email, para no revelar su existencia por tiempo
        const storedHash = employee ? employee.passwordHash : DUMMY_PASSWORD_HASH
        const isValid = await this.authService.comparePasswords(dto.passwordRaw, storedHash)

        if (!employee || !isValid) {
            throw new InvalidCredentialsError()
        }

        const token = this.authService.generateToken({
            id: employee.id,
            role: employee.role,
            restaurantId: employee.restaurantId
        })

        return {
            token,
            employee: {
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                role: employee.role,
                restaurantId: employee.restaurantId
            }
        }
    }
}
