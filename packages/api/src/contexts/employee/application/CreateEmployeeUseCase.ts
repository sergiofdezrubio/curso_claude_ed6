import { randomUUID } from 'crypto'
import { Employee } from '@employee/domain/Employee.js'
import type { IEmployeeRepository } from '@employee/domain/IEmployeeRepository.js'
import type { IAuthService } from '@employee/domain/IAuthService.js'
import { Password } from '@employee/domain/value-objects/Password.js'
import { Email } from '@shared/domain/value-objects/Email.js'
import { DuplicatedEmailError } from '@errors/DomainErrors.js'

export interface CreateEmployeeDTO {
    firstName: string
    lastName: string
    email: string
    passwordPlain: string
    role: string
    restaurantId: string | null
}

export class CreateEmployeeUseCase {
    constructor(
        private readonly employeeRepo: IEmployeeRepository,
        private readonly authService: IAuthService
    ) {}

    async execute(dto: CreateEmployeeDTO): Promise<Employee> {
        const email = new Email(dto.email).getValue()
        const existingEmployee = await this.employeeRepo.findByEmail(email)
        if (existingEmployee) {
            throw new DuplicatedEmailError()
        }

        const password = Password.create(dto.passwordPlain)
        const passwordHash = await this.authService.hashPassword(password.value)

        const employee = Employee.create({
            id: randomUUID(),
            firstName: dto.firstName,
            lastName: dto.lastName,
            email,
            passwordHash,
            role: dto.role,
            restaurantId: dto.restaurantId
        })

        await this.employeeRepo.save(employee)
        return employee
    }
}
