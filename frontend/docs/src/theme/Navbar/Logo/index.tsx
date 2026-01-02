import React from 'react';
import type {Props} from '@theme/Navbar/Logo';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function LogoWrapper(props: Props): JSX.Element {
  const logoSrc = useBaseUrl(props.src || 'img/logo.png');

  return (
    <Link to="/docs/overview" className={styles.logoWrapper}>
      <span className={styles.knotText}>Knot</span>
      <img 
        src={logoSrc} 
        alt={props.alt || 'KnotX Logo'} 
        width={props.width || 32} 
        height={props.height || 32}
        className={styles.logoImage}
      />
    </Link>
  );
}
