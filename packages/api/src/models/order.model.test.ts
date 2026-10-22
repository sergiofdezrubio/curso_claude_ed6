import { describe, it, expect } from 'vitest'
import { puedeTransicionar, TRANSICIONES_POR_ROL } from '@models/order.model.js'

describe('puedeTransicionar', () => {
    it('permite al cocinero pasar de pendiente a preparando y de preparando a listo', () => {
        expect(puedeTransicionar('cocinero', 'pendiente', 'preparando')).toBe(true)
        expect(puedeTransicionar('cocinero', 'preparando', 'listo')).toBe(true)
    })

    it('impide al cocinero entregar, saltar pasos o retroceder', () => {
        expect(puedeTransicionar('cocinero', 'listo', 'entregado')).toBe(false)
        expect(puedeTransicionar('cocinero', 'pendiente', 'listo')).toBe(false)
        expect(puedeTransicionar('cocinero', 'listo', 'preparando')).toBe(false)
    })

    it('permite al camarero solo pasar de listo a entregado', () => {
        expect(puedeTransicionar('camarero', 'listo', 'entregado')).toBe(true)
        expect(puedeTransicionar('camarero', 'pendiente', 'preparando')).toBe(false)
        expect(puedeTransicionar('camarero', 'preparando', 'listo')).toBe(false)
    })

    it('permite a manager y admin cualquier par de estados distintos, incluido retroceder y saltar', () => {
        for (const rol of ['manager', 'admin'] as const) {
            expect(puedeTransicionar(rol, 'pendiente', 'entregado')).toBe(true)
            expect(puedeTransicionar(rol, 'entregado', 'pendiente')).toBe(true)
            expect(puedeTransicionar(rol, 'listo', 'preparando')).toBe(true)
        }
    })

    it('no permite ninguna transición al cliente', () => {
        expect(TRANSICIONES_POR_ROL.cliente).toEqual([])
        expect(puedeTransicionar('cliente', 'pendiente', 'preparando')).toBe(false)
    })

    it('no considera transición pasar al mismo estado, para ningún rol', () => {
        for (const rol of ['admin', 'manager', 'camarero', 'cocinero', 'cliente'] as const) {
            expect(puedeTransicionar(rol, 'listo', 'listo')).toBe(false)
        }
    })
})
