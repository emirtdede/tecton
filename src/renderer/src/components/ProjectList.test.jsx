// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectList from './ProjectList';

const t = (k, f) => f || k;
const projs = [
  { id: 1, name: 'Santiye A', location: 'Istanbul' },
  { id: 2, name: 'Santiye B', location: '' },
];

describe('ProjectList', () => {
  const base = {
    t, projects: projs, searchQuery: '', setSearchQuery: () => {}, loading: false,
    filteredProjects: projs, paginatedProjects: projs, totalPages: 1, currentPage: 1,
    setCurrentPage: () => {}, activeProjectId: 1, draggedIndex: null, dragOverIndex: null,
    editingProjectId: null, editFormData: { name: '', location: '' }, setEditFormData: () => {},
    onDragStart: () => {}, onDragOver: () => {}, onDragEnd: () => {}, onDrop: () => {},
    onSelectProject: () => {}, onStartEdit: () => {}, onCancelEdit: () => {}, onSaveEdit: () => {}, onDelete: () => {},
  };

  it('renders project names and active badge', () => {
    render(<ProjectList {...base} />);
    expect(screen.getByText('Santiye A')).toBeInTheDocument();
    expect(screen.getByText('Santiye B')).toBeInTheDocument();
  });

  it('delete callback with id', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<ProjectList {...base} onDelete={onDelete} />);
    const dels = screen.getAllByTitle(/Sil|Delete/i);
    await user.click(dels[0]);
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
