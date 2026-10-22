import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { authController } from '@employee/infrastructure/http/dependencies.js'
import type { AuthController } from '@employee/infrastructure/http/AuthController.js'

const crearLimitador = (ventanaMs: number, maximo: number, mensaje: string, limitar: boolean) =>
  rateLimit({
    windowMs: ventanaMs,
    limit: maximo,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: mensaje },
    skip: () => !limitar
  })

// El límite solo se desactiva en NODE_ENV=test; los tests lo activan pasando `limitar = true`.
export const crearAuthRouter = (
  controlador: AuthController = authController,
  limitar: boolean = process.env.NODE_ENV !== 'test'
): Router => {
  const router = Router()

  const limitadorLogin = crearLimitador(
    15 * 60 * 1000,
    5,
    'Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde.',
    limitar
  )
  const limitadorRegistro = crearLimitador(
    60 * 60 * 1000,
    10,
    'Demasiados registros desde esta dirección. Inténtalo de nuevo más tarde.',
    limitar
  )

  router.post('/login', limitadorLogin, controlador.login)
  router.post('/register', limitadorRegistro, controlador.register)

  return router
}

export default crearAuthRouter()
