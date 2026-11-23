// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MediaViews from './MediaViews';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const items = [
  { id: 'material_1', type: 'material', typeLabel: 'Irsaliye', title: 'A - B', date: '2026-10-01', base64: null },
];

describe('MediaViews', () => {
  it('list view renders table rows', () => {
    render(
      <MediaViews t={t} i18n={i18n} loading={false} viewMode="list" paginatedItems={items} totalItems={1} totalPages={1} validCurrentPage={1} setCurrentPage={() => {}} onSelectImage={() => {}} />
    );
    expect(screen.getByText('A - B')).toBeInTheDocument();
  });

  it('gallery view renders cards and click selects', async () => {
    const user = userEvent.setup();
    const onSelectImage = vi.fn();
    const withImg = [{ ...items[0], base64: 'data:image/png;base64,xx' }];
    render(
      <MediaViews t={t} i18n={i18n} loading={false} viewMode="gallery" paginatedItems={withImg} totalItems={1} totalPages={1} validCurrentPage={1} setCurrentPage={() => {}} onSelectImage={onSelectImage} />
    );
    const card = screen.getByText('A - B').closest('.glass-card');
    await user.click(card);
    expect(onSelectImage).toHaveBeenCalledWith('data:image/png;base64,xx');
  });
});
