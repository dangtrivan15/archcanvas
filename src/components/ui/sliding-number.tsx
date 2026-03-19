/**
 * Animated sliding number display for integer counts.
 * Adapted from animate-ui's SlidingNumber primitive — simplified to
 * integers only, no in-view detection, no decimal/thousand separators.
 */

import * as React from 'react';
import {
  useSpring,
  useTransform,
  motion,
  type MotionValue,
  type SpringOptions,
} from 'motion/react';
import useMeasure from 'react-use-measure';

const defaultTransition: SpringOptions = { stiffness: 200, damping: 20, mass: 0.4 };

function Roller({
  prevValue,
  value,
  place,
  transition,
}: {
  prevValue: number;
  value: number;
  place: number;
  transition: SpringOptions;
}) {
  const startDigit = Math.floor(prevValue / place) % 10;
  const targetDigit = Math.floor(value / place) % 10;
  const spring = useSpring(startDigit, transition);

  React.useEffect(() => {
    spring.set(targetDigit);
  }, [targetDigit, spring]);

  const [ref, { height }] = useMeasure();

  return (
    <span
      ref={ref}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '1ch',
        overflowX: 'visible',
        overflowY: 'clip',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ visibility: 'hidden' }}>0</span>
      {Array.from({ length: 10 }, (_, i) => (
        <Digit key={i} motionValue={spring} digit={i} height={height} />
      ))}
    </span>
  );
}

function Digit({
  motionValue,
  digit,
  height,
}: {
  motionValue: MotionValue<number>;
  digit: number;
  height: number;
}) {
  const y = useTransform(motionValue, (latest) => {
    if (!height) return 0;
    const current = latest % 10;
    const offset = (10 + digit - current) % 10;
    let translateY = offset * height;
    if (offset > 5) translateY -= 10 * height;
    return translateY;
  });

  if (!height) {
    return <span style={{ visibility: 'hidden', position: 'absolute' }}>{digit}</span>;
  }

  return (
    <motion.span
      style={{
        y,
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {digit}
    </motion.span>
  );
}

interface SlidingNumberProps extends React.ComponentProps<'span'> {
  number: number;
  transition?: SpringOptions;
}

export function SlidingNumber({
  number: value,
  transition = defaultTransition,
  ...props
}: SlidingNumberProps) {
  const abs = Math.abs(Math.floor(value));
  const prevRef = React.useRef(abs);

  const digits = Math.max(1, abs.toString().length);
  const places = React.useMemo(
    () => Array.from({ length: digits }, (_, i) => Math.pow(10, digits - i - 1)),
    [digits],
  );

  const intStr = abs.toString();
  const prevStr = prevRef.current.toString().padStart(digits, '0');

  React.useEffect(() => {
    prevRef.current = abs;
  }, [abs]);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }} {...props}>
      {value < 0 && <span>-</span>}
      {places.map((place) => (
        <Roller
          key={place}
          prevValue={parseInt(prevStr, 10)}
          value={parseInt(intStr, 10)}
          place={place}
          transition={transition}
        />
      ))}
    </span>
  );
}
