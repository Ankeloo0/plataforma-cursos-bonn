import { create } from 'zustand';

export type TonoToast = 'exito' | 'critico';

interface Toast {
  id: number;
  tono: TonoToast;
  texto: string;
}

interface ToastState {
  toasts: Toast[];
  mostrar: (texto: string, tono?: TonoToast) => void;
  quitar: (id: number) => void;
}

let siguienteId = 1;
const DURACION_MS = 4000;

// Confirman acciones ("Empresa creada"). Los errores de un formulario van junto al campo.
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  mostrar(texto, tono = 'exito') {
    const id = siguienteId++;
    set({ toasts: [...get().toasts, { id, tono, texto }] });
    setTimeout(() => get().quitar(id), DURACION_MS);
  },
  quitar(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const mostrarToast = (texto: string, tono?: TonoToast) => useToastStore.getState().mostrar(texto, tono);
