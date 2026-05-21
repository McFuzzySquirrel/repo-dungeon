import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BasementExplorer } from '@/ui/components/BasementExplorer';
import type { LocalBasementNode } from '@/localRepos/types';

function makeNode(pathToken: string, parentPathToken: string | null, name: string, depth: number): LocalBasementNode {
  return {
    pathToken,
    parentPathToken,
    name,
    depth,
    openInSystemDefault: {
      rootPathToken: 'electron://root',
      repositoryPathToken: 'repo-a',
      targetPathToken: pathToken,
    },
  };
}

describe('BasementExplorer', () => {
  it('shows only the current level and supports descend/back navigation', () => {
    const onOpenPath = vi.fn();
    const nodes: LocalBasementNode[] = [
      makeNode('src', '', 'src', 1),
      makeNode('docs', '', 'docs', 1),
      makeNode('src/components', 'src', 'components', 2),
    ];

    render(<BasementExplorer nodes={nodes} onOpenPath={onOpenPath} isLaunching={false} />);

    expect(screen.getByRole('button', { name: 'Explore src' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore docs' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore components' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Explore src' }));

    expect(screen.getByRole('button', { name: 'Explore components' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore docs' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('button', { name: 'Explore docs' })).toBeInTheDocument();
  });

  it('dispatches open actions for current and listed nodes', () => {
    const onOpenPath = vi.fn();
    const nodes: LocalBasementNode[] = [
      makeNode('src', '', 'src', 1),
      makeNode('src/components', 'src', 'components', 2),
    ];

    render(<BasementExplorer nodes={nodes} onOpenPath={onOpenPath} isLaunching={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open src in default application' }));
    expect(onOpenPath).toHaveBeenCalledWith(nodes[0], 'system-default');

    fireEvent.click(screen.getByRole('button', { name: 'Explore src' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Current' }));
    expect(onOpenPath).toHaveBeenCalledWith(nodes[0], 'system-default');

    fireEvent.click(screen.getByRole('button', { name: 'Open in Editor' }));
    expect(onOpenPath).toHaveBeenCalledWith(nodes[0], 'preferred-editor');
  });
});
