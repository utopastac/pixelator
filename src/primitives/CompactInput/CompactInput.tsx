import React, { useRef, useEffect } from 'react';
import FieldLabel from '../FieldLabel';
import styles from './CompactInput.module.css';

/**
 * A compact inline input for property panel and inspector UIs — think Figma's dimension
 * fields or a CSS value editor. It is not a form input: the error state is a boolean
 * border highlight only, with no error message. For form inputs with validation messages
 * and helper text, use `Input` instead.
 */
interface CompactInputProps {
  prefix: string;
  prefixSlot?: React.ReactNode;
  label?: string;
  labelPosition?: 'top' | 'left';
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  min?: number;
  max?: number;
  step?: number;
  scrub?: boolean;
  labelWidth?: number | string;
  onBlur?: () => void;
  id?: string;
  className?: string;
  placeholder?: string;
  width?: number | string;
}

const CompactInput: React.FC<CompactInputProps> = ({
  prefix,
  prefixSlot,
  label,
  labelPosition = 'top',
  type = 'text',
  value,
  onChange,
  error = false,
  min,
  max,
  step = 1,
  scrub = false,
  labelWidth,
  onBlur,
  id,
  className = '',
  placeholder,
  width,
}) => {
  const prefixRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef({ onChange, min, max, step, value });
  stateRef.current = { onChange, min, max, step, value };

  useEffect(() => {
    const el = prefixRef.current;
    if (!el || !scrub) return;

    let startX = 0;
    let startValue = 0;

    const handleMove = (e: MouseEvent) => {
      const { onChange: onCh, min: lo, max: hi, step: s } = stateRef.current;
      const delta = e.clientX - startX;
      const sensitivity = s < 1 ? s : 1;
      let next = startValue + Math.round(delta / 2) * sensitivity;
      next = Math.round(next / s) * s;
      if (lo !== undefined) next = Math.max(lo, next);
      if (hi !== undefined) next = Math.min(hi, next);
      const formatted = s < 1 ? next.toFixed(String(s).split('.')[1]?.length || 2) : String(next);
      onCh(formatted);
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const handleDown = (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startValue = parseFloat(stateRef.current.value) || 0;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    };

    el.addEventListener('mousedown', handleDown);
    return () => {
      el.removeEventListener('mousedown', handleDown);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [scrub]);

  const input = (
    <div className={`${styles.wrapper} ${error ? styles.error : ''} ${!label ? className : ''}`} style={width !== undefined ? { width } : undefined}>
      <span
        ref={prefixRef}
        className={`${styles.prefix} ${scrub ? styles.scrub : ''}`}
      >
        {prefixSlot ?? prefix}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={styles.input}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
      />
    </div>
  );

  if (!label) return input;

  return (
    <FieldLabel label={label} labelPosition={labelPosition} labelWidth={labelWidth} htmlFor={id} className={className}>
      {input}
    </FieldLabel>
  );
};

export default CompactInput;
