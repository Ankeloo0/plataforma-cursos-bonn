import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AdministradorPage } from '../features/administradores/pages/AdministradorPage';
import { AdministradoresPage } from '../features/administradores/pages/AdministradoresPage';
import { CambiarPasswordPage } from '../features/auth/pages/CambiarPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { EmpresaDetallePage } from '../features/empresas/pages/EmpresaDetallePage';
import { EmpresasPage } from '../features/empresas/pages/EmpresasPage';
import { CatalogoPage } from '../features/catalogo/pages/CatalogoPage';
import { CursosPage } from '../features/cursos/pages/CursosPage';
import { EditorCursoPage } from '../features/cursos/pages/EditorCursoPage';
import { EmpleadoPage } from '../features/empleados/pages/EmpleadoPage';
import { EmpleadosPage } from '../features/empleados/pages/EmpleadosPage';
import { InicioEmpleadoPage } from '../features/inicio/pages/InicioEmpleadoPage';
import { MarcasPage } from '../features/marcas/pages/MarcasPage';
import { PerfilPage } from '../features/perfil/pages/PerfilPage';
import { EmpleadoLayout } from '../layouts/EmpleadoLayout';
import { PanelLayout } from '../layouts/PanelLayout';
import { LayoutSegunRol } from './LayoutSegunRol';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { RoleRoute } from './RoleRoute';
import { InicioPanel } from './InicioPanel';

// Rutas de technical-spec 5.3
const rutas: RouteObject[] = [
  { element: <PublicOnlyRoute />, children: [{ path: '/login', element: <LoginPage /> }] },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/cambiar-password', element: <CambiarPasswordPage /> },
      { element: <LayoutSegunRol />, children: [{ path: '/perfil', element: <PerfilPage /> }] },
      {
        element: <RoleRoute roles={['SUPERUSUARIO', 'ADMIN']} />,
        children: [
          {
            element: <PanelLayout />,
            children: [
              {
                element: <RoleRoute roles={['SUPERUSUARIO']} />,
                children: [
                  { path: '/empresas', element: <EmpresasPage /> },
                  { path: '/empresas/:id', element: <EmpresaDetallePage /> },
                  { path: '/administradores', element: <AdministradoresPage /> },
                  { path: '/administradores/:id', element: <AdministradorPage /> },
                ],
              },
              {
                element: <RoleRoute roles={['SUPERUSUARIO', 'ADMIN']} permisos={['MARCAS_GESTIONAR']} />,
                children: [{ path: '/marcas', element: <MarcasPage /> }],
              },
              {
                element: <RoleRoute roles={['SUPERUSUARIO', 'ADMIN']} permisos={['CATALOGO_GESTIONAR']} />,
                children: [{ path: '/catalogo', element: <CatalogoPage /> }],
              },
              {
                element: <RoleRoute roles={['SUPERUSUARIO', 'ADMIN']} permisos={['CURSOS_GESTIONAR', 'CURSOS_PUBLICAR', 'CURSOS_ASIGNAR']} />,
                children: [
                  { path: '/cursos', element: <CursosPage /> },
                  { path: '/cursos/:id/editar', element: <EditorCursoPage /> },
                ],
              },
              {
                element: <RoleRoute roles={['SUPERUSUARIO', 'ADMIN']} permisos={['EMPLEADOS_VER']} />,
                children: [
                  { path: '/empleados', element: <EmpleadosPage /> },
                  { path: '/empleados/:id', element: <EmpleadoPage /> },
                ],
              },
              {
                element: <RoleRoute roles={['SUPERUSUARIO', 'ADMIN']} />,
                // Sin dashboard todavia (I7): el superusuario empieza en empresas
                children: [{ path: '/panel', element: <InicioPanel /> }],
              },
            ],
          },
        ],
      },
      {
        element: <RoleRoute roles={['EMPLEADO']} />,
        children: [{ element: <EmpleadoLayout />, children: [{ path: '/', element: <InicioEmpleadoPage /> }] }],
      },
    ],
  },
];

// Catalogo de componentes: solo en desarrollo, cargado de forma diferida para que no llegue a produccion
if (import.meta.env.DEV) {
  rutas.push({
    path: '/componentes',
    lazy: async () => ({ Component: (await import('../features/sistema/pages/ComponentesPage')).ComponentesPage }),
  });
}

rutas.push({ path: '*', element: <Navigate to="/" replace /> });

export const router = createBrowserRouter(rutas);
