import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input, type InputProps } from './Input';
import styles from './PasswordInput.module.css';

export function PasswordInput(props: Omit<InputProps, 'type' | 'final'>) {
  const [visible, setVisible] = useState(false);
  const Icono = visible ? EyeOff : Eye;

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      // Evita que el navegador corrija o ponga mayusculas a la contrasena visible
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      final={
        <button
          type="button"
          className={styles.alternar}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      }
    />
  );
}
