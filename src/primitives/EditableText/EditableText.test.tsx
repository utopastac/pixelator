import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditableText from './EditableText';
import styles from './EditableText.module.css';

function Controlled(props: {
  initial?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onEditStart?: () => void;
  onEditEnd?: (reason: 'commit' | 'cancel') => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(props.initial ?? 'Layer 1');
  return (
    <EditableText
      value={value}
      disabled={props.disabled}
      placeholder={props.placeholder}
      onEditStart={props.onEditStart}
      onEditEnd={props.onEditEnd}
      onCancel={props.onCancel}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
    />
  );
}

describe('EditableText', () => {
  it('renders the value in a span with role=button and aria-label', () => {
    render(<Controlled initial="Hello" />);
    const span = screen.getByRole('button', { name: 'Hello' });
    expect(span.tagName).toBe('SPAN');
  });

  it('enters edit mode on double-click and focuses the input', async () => {
    const user = userEvent.setup();
    const onEditStart = vi.fn();
    render(<Controlled initial="Hello" onEditStart={onEditStart} />);
    await user.dblClick(screen.getByRole('button', { name: 'Hello' }));
    const input = await screen.findByRole('textbox');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Hello');
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  it('enters edit mode on Enter keydown of the span', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="Hi" />);
    const span = screen.getByRole('button', { name: 'Hi' });
    span.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('textbox')).toHaveFocus();
  });

  it('Enter commits the draft and calls onChange + onEditEnd("commit")', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onEditEnd = vi.fn();
    render(<Controlled initial="A" onChange={onChange} onEditEnd={onEditEnd} />);
    await user.dblClick(screen.getByRole('button', { name: 'A' }));
    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('Renamed');
    expect(onEditEnd).toHaveBeenCalledWith('commit');
    // Back in display mode
    expect(screen.getByRole('button', { name: 'Renamed' })).toBeInTheDocument();
  });

  it('Escape cancels without calling onChange and fires onCancel + onEditEnd("cancel")', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const onEditEnd = vi.fn();
    render(
      <Controlled
        initial="Keep"
        onChange={onChange}
        onCancel={onCancel}
        onEditEnd={onEditEnd}
      />,
    );
    await user.dblClick(screen.getByRole('button', { name: 'Keep' }));
    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Discarded');
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEditEnd).toHaveBeenCalledWith('cancel');
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it('blur commits the draft', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="A" onChange={onChange} />);
    await user.dblClick(screen.getByRole('button', { name: 'A' }));
    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Blurred');
    // Tab away — input blurs and commits
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith('Blurred');
    expect(screen.getByRole('button', { name: 'Blurred' })).toBeInTheDocument();
  });

  it('commits with an empty/whitespace draft cancels instead of committing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="Original" onChange={onChange} />);
    await user.dblClick(screen.getByRole('button', { name: 'Original' }));
    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, '   ');
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Original' })).toBeInTheDocument();
  });

  it('disabled variant renders a plain span without role=button and is not editable', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="Locked" disabled />);
    const span = screen.getByText('Locked');
    expect(span).toHaveClass(styles.disabled);
    expect(span).not.toHaveAttribute('role');
    await user.dblClick(span);
    // No input appears because edit mode is gated on !disabled.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the placeholder when value is empty', () => {
    render(<Controlled initial="" placeholder="Untitled" />);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });
});
