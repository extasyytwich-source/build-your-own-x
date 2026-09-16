import { motion, useScroll, useSpring } from 'framer-motion';

// Barra fina pegada al borde inferior del nav que se llena según cuánto se
// avanzó en la página — ayuda a ubicarse en una landing larga como esta.
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      style={{ scaleX }}
      className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-iris via-coral to-aqua"
    />
  );
}
