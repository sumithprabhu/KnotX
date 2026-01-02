import React from 'react';
import OriginalLogo from '@theme-original/Navbar/Logo';
import type {Props} from '@theme/Navbar/Logo';
import styles from './styles.module.css';

export default function LogoWrapper(props: Props): JSX.Element {
  return (
    <div className={styles.logoWrapper}>
      <span className={styles.knotText}>Knot</span>
      <OriginalLogo {...props} />
    </div>
  );
}
