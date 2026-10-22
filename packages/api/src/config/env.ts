import 'dotenv/config'

// Valor fijo SOLO para desarrollo y tests. Nunca se usa en producción.
const SECRETO_DESARROLLO = 'super-secret-resttek-key'
const LONGITUD_MINIMA_SECRETO = 32

const entorno = process.env.NODE_ENV ?? 'development'
const esEntornoLocal = entorno === 'test' || entorno === 'development'
const secretoDefinido = process.env.JWT_SECRET

if (!esEntornoLocal && (!secretoDefinido || secretoDefinido.length < LONGITUD_MINIMA_SECRETO)) {
  throw new Error(
    `JWT_SECRET es obligatorio en el entorno "${entorno}" y debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres.`
  )
}

export const JWT_SECRET: string = secretoDefinido || SECRETO_DESARROLLO
