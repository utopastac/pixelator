import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './EditableText.module.css';
import { resolveSize } from '../../utils/resolveSize';

export interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  size?: 's' | 'sm' | 'small' | 'm' | 'md' | 'medium' | 'l' | 'lg' | 'large';
  disabled?: boolean;
  placeholder?: string;
  /** Override the text shown in display mode. The edit-mode input still
   *  initialises from `value`. Useful when the display label should differ
   *  from the editable string (e.g. showing a short name while editing the
   *  full prefixed name). */
  displayValue?: string;
  ariaLabel?: string;
  className?: string;
  /** Upper bound (in px) for the edit-mode input. The input grows with the
   *  draft up to this width, then scrolls internally. Default 320. */
  maxWidth?: number;
  onEditStart?: () => void;
  onEditEnd?: (reason: 'commit' | 'cancel') => void;
  onCancel?: () => void;
  'data-testid'?: string;
}

type ResolvedSize = 'sm' | 'md' | 'lg';

const sizeClassMap: Record<ResolvedSize, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * EditableText renders a label that swaps to an input on double-click or Enter.
 *
 * The display `<span>` and edit `<input>` share a single `.field` class so
 * typography, padding, border, and height stay identical across the swap.
 *
 * ```tsx
 * <EditableText value={name} onChange={setName} size="md" />
 * ```
 */
const EditableText: React.FC<EditableTextProps> = ({
  value,
  onChange,
  size,
  disabled = false,
  placeholder,
  displayValue,
  ariaLabel,
  className = '',
  maxWidth = 320,
  onEditStart,
  onEditEnd,
  onCancel,
  'data-testid': dataTestId,
}) => {
  const resolved = resolveSize<ResolvedSize>(size as ResolvedSize | undefined, 'md');
  const sizeClass = sizeClassMap[resolved];

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [inputWidth, setInputWidth] = useState<number | null>(null);

  const spanRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Track the sizer span's intrinsic width and apply it to the input so the
  // input grows with the draft text, capped by `maxWidth`.
  useLayoutEffect(() => {
    if (!isEditing) {
      setInputWidth(null);
      return;
    }
    if (sizerRef.current) {
      setInputWidth(sizerRef.current.offsetWidth);
    }
  }, [isEditing, draft, placeholder]);

  const enterEditMode = () => {
    if (disabled) return;
    setDraft(value);
    setIsEditing(true);
    onEditStart?.();
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      cancel();
      return;
    }
    if (trimmed !== value) {
      onChange(draft);
    }
    setIsEditing(false);
    onEditEnd?.('commit');
  };

  const cancel = () => {
    setIsEditing(false);
    onCancel?.();
    onEditEnd?.('cancel');
  };

  const handleSpanKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enterEditMode();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  if (isEditing) {
    const inputClassNames = [styles.field, sizeClass, styles.editing, className]
      .filter(Boolean)
      .join(' ');
    const sizerClassNames = [styles.field, sizeClass, styles.sizer].filter(Boolean).join(' ');
    const sizerText = draft.length > 0 ? draft : placeholder ?? '';

    return (
      <span className={styles.editWrapper} style={{ maxWidth }}>
        <input
          ref={inputRef}
          type="text"
          className={inputClassNames}
          data-testid={dataTestId}
          value={draft}
          placeholder={placeholder}
          aria-label={ariaLabel ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={commit}
          style={inputWidth !== null ? { width: inputWidth } : undefined}
        />
        <span ref={sizerRef} className={sizerClassNames} aria-hidden="true">
          {sizerText || '\u00A0'}
        </span>
      </span>
    );
  }

  const displayText = (displayValue ?? value) === '' ? placeholder ?? '' : (displayValue ?? value);
  const isPlaceholder = (displayValue ?? value) === '';

  const spanClassNames = [
    styles.field,
    sizeClass,
    !disabled ? styles.editable : '',
    disabled ? styles.disabled : '',
    isPlaceholder ? styles.placeholder : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (disabled) {
    return (
      <span ref={spanRef} className={spanClassNames} data-testid={dataTestId}>
        {displayText}
      </span>
    );
  }

  return (
    <span
      ref={spanRef}
      className={spanClassNames}
      data-testid={dataTestId}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? value}
      onDoubleClick={enterEditMode}
      onKeyDown={handleSpanKeyDown}
    >
      {displayText}
    </span>
  );
};

export default EditableText;
