import styles from './LogoPlataforma.module.css';

// Nombre provisional de la plataforma en el lugar del logotipo (P-57, design-reference 3.0).
// Cuando exista el logotipo se cambia solo aqui.
export function LogoPlataforma({ alto = 32, className }: { alto?: number; className?: string }) {
  return (
    <span className={[styles.logo, className].filter(Boolean).join(' ')} style={{ fontSize: alto * 0.8, height: alto }}>
      Cursos
    </span>
  );
}
