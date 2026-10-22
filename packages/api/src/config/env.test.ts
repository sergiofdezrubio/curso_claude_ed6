import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRETO_DESARROLLO = 'super-secret-resttek-key'
const SECRETO_VALIDO = 'a'.repeat(32)

// Importa env.ts desde cero para que se reevalúe con el entorno actual.
// Se usa '' en vez de undefined para que dotenv no cargue un .env (no pisa variables definidas).
const cargarEnv = async () => {
  vi.resetModules()
  return import('./env.js')
}

describe('config/env', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('falla en producción si falta JWT_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', '')

    await expect(cargarEnv()).rejects.toThrow(/JWT_SECRET es obligatorio/)
  })

  it('falla en producción si JWT_SECRET mide menos de 32 caracteres', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', 'a'.repeat(31))

    await expect(cargarEnv()).rejects.toThrow(/al menos 32 caracteres/)
  })

  it('en producción devuelve el JWT_SECRET válido', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', SECRETO_VALIDO)

    const { JWT_SECRET } = await cargarEnv()

    expect(JWT_SECRET).toBe(SECRETO_VALIDO)
  })

  it('en test sin JWT_SECRET usa el valor de desarrollo', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('JWT_SECRET', '')

    const { JWT_SECRET } = await cargarEnv()

    expect(JWT_SECRET).toBe(SECRETO_DESARROLLO)
  })

  it('en development sin JWT_SECRET usa el valor de desarrollo', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('JWT_SECRET', '')

    const { JWT_SECRET } = await cargarEnv()

    expect(JWT_SECRET).toBe(SECRETO_DESARROLLO)
  })
})
