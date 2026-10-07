import { useState } from 'react';
import { Dialogo } from '../../../components/ui/Dialogo';
import { PanelLateral } from '../../../components/ui/PanelLateral';
import { mostrarToast } from '../../../components/ui/toast.store';
import type { ApiError } from '../../../services/api/client';
import { FormularioRestablecer } from '../../administradores/components/FormularioRestablecer';
import type { Puesto } from '../../catalogo/types/catalogo.types';
import type { Sucursal } from '../../empresas/types/empresas.types';
import { empleadosService } from '../services/empleados.service';
import type { Empleado } from '../types/empleados.types';
import { nombreEmpleado, type AccionEmpleado } from '../utils/empleado';
import { FormularioEmpleado, type CambiosEmpleado } from './FormularioEmpleado';

// La foto se sube despues de guardar los datos: si falla, los datos ya quedaron guardados
async function guardarFoto(empleadoId: string, foto: File | null | undefined): Promise<void> {
  if (foto === undefined) return;
  try {
    if (foto) await empleadosService.cambiarFoto(empleadoId, foto);
    else await empleadosService.quitarFoto(empleadoId);
  } catch (error) {
    mostrarToast(`Los datos se guardaron, pero la foto no: ${(error as ApiError).message}`, 'critico');
  }
}

// Paneles laterales y dialogo de las acciones de un empleado (alta, edicion, contrasena y baja)
export function GestionEmpleado({
  accion,
  sucursales,
  puestos,
  alCerrar,
  alCambiar,
}: {
  accion: AccionEmpleado;
  sucursales: Sucursal[];
  puestos: Puesto[];
  alCerrar: () => void;
  // Recibe el empleado creado o editado, si lo hay
  alCambiar: (empleado?: Empleado) => void;
}) {
  const [procesando, setProcesando] = useState(false);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);

  async function crear({ datos, passwordTemporal, foto }: CambiosEmpleado) {
    const creado = await empleadosService.crear({ ...datos, passwordTemporal: passwordTemporal ?? '' });
    await guardarFoto(creado.id, foto);
    alCerrar();
    alCambiar(creado);
    mostrarToast(`Empleado dado de alta. Entrégale su número ${creado.numeroEmpleado} y su contraseña temporal.`);
  }

  async function editar(empleado: Empleado, { datos, foto }: CambiosEmpleado) {
    const editado = await empleadosService.actualizar(empleado.id, datos);
    await guardarFoto(empleado.id, foto);
    alCerrar();
    alCambiar(editado);
    mostrarToast('Empleado actualizado');
  }

  async function restablecer(empleado: Empleado, passwordTemporal: string) {
    await empleadosService.restablecerPassword(empleado.usuarioId, passwordTemporal);
    alCerrar();
    alCambiar();
    mostrarToast('Contraseña restablecida');
  }

  async function desactivar(empleado: Empleado) {
    setProcesando(true);
    setErrorConfirmacion(null);
    try {
      await empleadosService.cambiarEstado(empleado.usuarioId, false);
      alCerrar();
      alCambiar();
      mostrarToast('Empleado dado de baja');
    } catch (error) {
      setErrorConfirmacion((error as ApiError).message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <>
      <PanelLateral
        abierto={accion?.tipo === 'nuevo'}
        titulo="Nuevo empleado"
        descripcion="Entra con su empresa y su número de empleado; no necesita usuario."
        alCerrar={alCerrar}
      >
        {accion?.tipo === 'nuevo' && <FormularioEmpleado sucursales={sucursales} puestos={puestos} alGuardar={crear} alCancelar={alCerrar} />}
      </PanelLateral>

      <PanelLateral abierto={accion?.tipo === 'editar'} titulo="Editar empleado" alCerrar={alCerrar}>
        {accion?.tipo === 'editar' && (
          <FormularioEmpleado
            key={accion.empleado.id}
            empleado={accion.empleado}
            sucursales={sucursales}
            puestos={puestos}
            alGuardar={(cambios) => editar(accion.empleado, cambios)}
            alCancelar={alCerrar}
          />
        )}
      </PanelLateral>

      <PanelLateral
        abierto={accion?.tipo === 'restablecer'}
        titulo="Restablecer contraseña"
        descripcion={
          accion?.tipo === 'restablecer'
            ? `Se cerrarán las sesiones de ${nombreEmpleado(accion.empleado)} y, al entrar con esta contraseña, deberá crear una nueva.`
            : undefined
        }
        alCerrar={alCerrar}
      >
        {accion?.tipo === 'restablecer' && (
          <FormularioRestablecer alGuardar={(password) => restablecer(accion.empleado, password)} alCancelar={alCerrar} />
        )}
      </PanelLateral>

      <Dialogo
        abierto={accion?.tipo === 'desactivar'}
        titulo={accion?.tipo === 'desactivar' ? `¿Dar de baja a ${nombreEmpleado(accion.empleado)}?` : ''}
        textoConfirmar="Dar de baja"
        textoCargando="Dando de baja…"
        peligro
        cargando={procesando}
        error={errorConfirmacion}
        alConfirmar={() => accion?.tipo === 'desactivar' && desactivar(accion.empleado)}
        alCancelar={() => {
          setErrorConfirmacion(null);
          alCerrar();
        }}
      >
        <p>Se cerrarán sus sesiones y no podrá entrar. Su historial y sus certificados se conservan, y puedes reactivarlo después.</p>
      </Dialogo>
    </>
  );
}
