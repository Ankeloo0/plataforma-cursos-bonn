import logo from '../../assets/grupo-bonn-logo.png';
import styles from './LogoPlataforma.module.css';

// Logotipo de Grupo Bonn (P-57, design-reference 3.0). Los layouts pueden fijar la altura por CSS.
export function LogoPlataforma({ alto = 40, className }: { alto?: number; className?: string }) {
  return <img src={logo} alt="Grupo Bonn" height={alto} className={[styles.logo, className].filter(Boolean).join(' ')} />;
}
