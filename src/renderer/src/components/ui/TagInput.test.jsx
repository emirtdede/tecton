// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagInput from './TagInput';

function Harness({ initial = [], onChange }) {
  const [tags, setTags] = useState(initial);
  return <TagInput tags={tags} setTags={(t) => { setTags(t); onChange && onChange(t); }} />;
}

describe('TagInput', () => {
  it('renders placeholder when empty', () => {
    render(<Harness />);
    expect(screen.getByPlaceholderText(/Etiket ekle/)).toBeInTheDocument();
  });

  it('adds tag on Enter and clears input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Etiket ekle/);
    await user.type(input, 'santiye{Enter}');
    expect(onChange).toHaveBeenCalledWith(['santiye']);
    expect(screen.getByText('#santiye')).toBeInTheDocument();
    expect(input.value).toBe('');
  });

  it('ignores duplicates and blanks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={['a']} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Yeni etiket/);
    await user.type(input, 'a{Enter}');
    await user.type(input, '   {Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes tag on × click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={['a', 'b']} onChange={onChange} />);
    const buttons = screen.getAllByText('×');
    await user.click(buttons[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});
