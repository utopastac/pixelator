import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompactInput from './CompactInput';
import styles from './CompactInput.module.css';

function Controlled(props: {
  initial?: string;
  onChange?: (v: string) => void;
  min?: number;
  max?: number;
  type?: string;
  error?: boolean;
}) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <CompactInput
      prefix="W"
      value={value}
      type={props.type}
      min={props.min}
      max={props.max}
      error={props.error}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
    />
  );
}

describe('CompactInput', () => {
  it('renders the prefix text and an input with the controlled value', () => {
    render(<CompactInput prefix="H" value="24" onChange={() => {}} />);
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
  });

  it('renders prefixSlot in place of prefix text when provided', () => {
    render(
      <CompactInput
        prefix="W"
        prefixSlot={<span>slot</span>}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('slot')).toBeInTheDocument();
    expect(screen.queryByText('W')).not.toBeInTheDocument();
  });

  it('fires onChange with the new raw string as the user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.type(screen.getByRole('textbox'), 'ab');
    expect(onChange).toHaveBeenCalledWith('a');
    expect(onChange).toHaveBeenLastCalledWith('ab');
    expect(screen.getByDisplayValue('ab')).toBeInTheDocument();
  });

  it('forwards min, max, and step to the native input', () => {
    render(
      <CompactInput
        prefix="W"
        type="number"
        value="5"
        min={1}
        max={10}
        step={2}
        onChange={() => {}}
      />,
    );
    const input = screen.getByDisplayValue('5');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '10');
    expect(input).toHaveAttribute('step', '2');
  });

  it('toggles the error class on the wrapper', () => {
    const { container, rerender } = render(
      <CompactInput prefix="W" value="" onChange={() => {}} />,
    );
    const wrapper = container.querySelector(`.${styles.wrapper}`);
    expect(wrapper).not.toBeNull();
    expect(wrapper).not.toHaveClass(styles.error);
    rerender(<CompactInput prefix="W" value="" onChange={() => {}} error />);
    expect(container.querySelector(`.${styles.wrapper}`)).toHaveClass(
      styles.error,
    );
  });

  it('fires onBlur when the input loses focus', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(
      <CompactInput prefix="W" value="1" onChange={() => {}} onBlur={onBlur} />,
    );
    const input = screen.getByDisplayValue('1');
    input.focus();
    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('wraps in FieldLabel when a label is provided and links htmlFor to id', () => {
    render(
      <CompactInput
        prefix="W"
        value="10"
        onChange={() => {}}
        label="Width"
        id="w-input"
      />,
    );
    const label = screen.getByText('Width');
    expect(label).toHaveAttribute('for', 'w-input');
    const input = screen.getByDisplayValue('10');
    expect(input).toHaveAttribute('id', 'w-input');
  });
});
