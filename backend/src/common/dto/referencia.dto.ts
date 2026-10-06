// Datos minimos de un registro relacionado (empresa, marca, sucursal, usuario) dentro de una respuesta
export class ReferenciaDto {
  id: string;
  nombre: string;
}

export class ReferenciaConEstadoDto extends ReferenciaDto {
  activo: boolean;
}
