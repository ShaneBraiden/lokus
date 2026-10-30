import { LazyMotion, MotionConfig, m, type Variants } from 'motion/react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

export { m, AnimatePresence } from 'motion/react';

const loadFeatures = () => import('./motionFeatures').then((mod) => mod.default);

/** One place for motion: DOM features load after first paint, and the visitor's reduced-motion setting is honoured. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, as = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={revealVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -80px 0px' }} transition={{ delay }}>
      {children}
    </Tag>
  );
}

const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** A list whose items enter one after another. Use StaggerItem for each child. */
export function Stagger({ children, className, as = 'div', inView = false }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol'; inView?: boolean }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={staggerParent} initial="hidden" {...(inView ? { whileInView: 'show', viewport: { once: true, margin: '0px 0px -60px 0px' } } : { animate: 'show' })}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={staggerChild}>
      {children}
    </Tag>
  );
}

/** Route content fades in on navigation (entrance only, so it never delays leaving a page). */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const { pathname } = useLocation();
  return (
    <m.div key={pathname} className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE_OUT }}>
      {children}
    </m.div>
  );
}
