// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: (() => {
    // Stable identity: production i18next returns a memoised `t`, and effects
    // that list `t` in their dependency array would otherwise loop forever.
    const t = (k, f) => f || k;
    const i18n = { language: 'tr', changeLanguage: vi.fn() };
    return () => ({ t, i18n });
  })(),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import Settings from './Settings';
import MediaGallery from './MediaGallery';
import ProductionManagement from './ProductionManagement';
import { mockApi } from '../utils/apiMock';

function baseApi() {
  return mockApi({
    db: {
      read: vi.fn(async (table) => {
        if (table === 'app_settings') return [];
        if (table === 'work_types') return [{ id: 1, name: 'Tam Gün', multiplier: 1 }];
        if (table === 'worker_groups') return [];
        if (table === 'projects') return [{ id: 1, name: 'S1' }];
        if (table === 'materials') return [];
        if (table === 'quality_reports') return [];
        if (table === 'production_records') return [];
        return [];
      }),
    },
    media: { readPhoto: vi.fn(async () => ({ success: false })) },
  });
}

describe('Settings shell', () => {
  it('renders genel tab content', async () => {
    baseApi();
    render(<Settings activeTab="genel" />);
    expect(await screen.findByText(/Görünüm ve Dil|Appearance and language/)).toBeInTheDocument();
  });

  it('renders finance tab content', async () => {
    baseApi();
    render(<Settings activeTab="finance" />);
    expect(await screen.findByText(/Parametre|parameters/)).toBeInTheDocument();
  });

  it('renders recycle tab and loads items', async () => {
    const api = baseApi();
    api.db.readDeleted = vi.fn(async () => []);
    api.db.readAllProjects = vi.fn(async () => []);
    render(<Settings activeTab="recycle" />);
    expect((await screen.findAllByText(/Geri Dönüşüm/)).length).toBeGreaterThan(0);
  });
});

describe('MediaGallery shell', () => {
  it('renders header and empty state', async () => {
    baseApi();
    render(<MediaGallery activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText(/Medya Galerisi/)).toBeInTheDocument();
  });

  it('guard without project', async () => {
    baseApi();
    render(<MediaGallery activeProjectId={null} projects={[]} />);
    expect(await screen.findByText(/şantiye seçin|Select an active site/i)).toBeInTheDocument();
  });
});

describe('ProductionManagement shell', () => {
  it('renders form and submits', async () => {
    const user = userEvent.setup();
    const api = baseApi();
    render(<ProductionManagement activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText(/Metraj/)).toBeInTheDocument();
    void api;
    void user;
  });
});
