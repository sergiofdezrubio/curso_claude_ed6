import express from 'express'
import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { crearAuthRouter } from './auth.routes.js'

const controladorFalso = {
  login: (_req: express.Request, res: express.Response) => {
    res.status(401).json({ error: 'Credenciales inválidas' })
  },
  register: (_req: express.Request, res: express.Response) => {
    res.status(201).json({ ok: true })
  }
} as never

const crearApp = (limitar: boolean) => {
  const app = express()
  app.use(express.json())
  app.use('/auth', crearAuthRouter(controladorFalso, limitar))
  return app
}

describe('rate limiting de auth', () => {
  it('el sexto login seguido devuelve 429 con mensaje en español y cabeceras estándar', async () => {
    const app = crearApp(true)
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/auth/login').send({})
      expect(res.status).toBe(401)
    }
    const res = await request(app).post('/auth/login').send({})
    expect(res.status).toBe(429)
    expect(res.body).toEqual({
      error: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde.'
    })
    expect(res.headers['ratelimit-limit']).toBeDefined()
    expect(res.headers['retry-after']).toBeDefined()
    expect(res.headers['x-ratelimit-limit']).toBeUndefined()
  })

  it('la petición 11 de registro devuelve 429', async () => {
    const app = crearApp(true)
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/auth/register').send({})
      expect(res.status).toBe(201)
    }
    const res = await request(app).post('/auth/register').send({})
    expect(res.status).toBe(429)
    expect(res.body).toEqual({
      error: 'Demasiados registros desde esta dirección. Inténtalo de nuevo más tarde.'
    })
  })

  it('sin límite activo nunca devuelve 429', async () => {
    const app = crearApp(false)
    for (let i = 0; i < 8; i++) {
      const res = await request(app).post('/auth/login').send({})
      expect(res.status).toBe(401)
    }
  })
})
