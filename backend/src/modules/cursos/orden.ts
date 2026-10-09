import type { EntityManager } from 'typeorm';

// Reordenar en dos pasos dentro de la transaccion (database-design 4.3): primero se suma 1000 a todos,
// para que ninguno choque con el UNIQUE (padre, orden), y luego se escribe el orden final 1, 2, 3...
// No se toca actualizado_en: mover un tema no cambia su contenido, y asi no invalida otra edicion abierta.
export async function guardarOrden(
  manager: EntityManager,
  tabla: 'temas' | 'materiales',
  columnaPadre: 'curso_id' | 'tema_id',
  padreId: string,
  ids: string[],
): Promise<void> {
  await manager.query(`UPDATE ${tabla} SET orden = orden + 1000 WHERE ${columnaPadre} = $1`, [padreId]);
  for (const [indice, id] of ids.entries()) {
    await manager.query(`UPDATE ${tabla} SET orden = $1 WHERE id = $2 AND ${columnaPadre} = $3`, [indice + 1, id, padreId]);
  }
}

// El siguiente numero libre al final; si dos personas agregan a la vez, el UNIQUE responde 409
export async function siguienteOrden(
  manager: EntityManager,
  tabla: 'temas' | 'materiales',
  columnaPadre: 'curso_id' | 'tema_id',
  padreId: string,
): Promise<number> {
  const [fila] = await manager.query(`SELECT coalesce(max(orden), 0) + 1 AS siguiente FROM ${tabla} WHERE ${columnaPadre} = $1`, [padreId]);
  return Number(fila.siguiente);
}
