import { useMemo, useState } from 'react';
import type { LocalBasementNode, LocalRoomLaunchMode } from '@/localRepos/types';
import '@/ui/styles/basement-explorer.css';

interface BasementExplorerProps {
  nodes: LocalBasementNode[];
  onOpenPath: (node: LocalBasementNode, mode: LocalRoomLaunchMode) => void;
  isLaunching: boolean;
}

function splitPath(pathToken: string): string[] {
  return pathToken
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function joinPath(parts: string[]): string {
  return parts.length > 0 ? parts.join('/') : 'Repository root';
}

export function BasementExplorer({ nodes, onOpenPath, isLaunching }: BasementExplorerProps) {
  const [currentPathToken, setCurrentPathToken] = useState('');

  const nodesByParent = useMemo(() => {
    const grouped = new Map<string, LocalBasementNode[]>();
    for (const node of nodes) {
      const parentKey = node.parentPathToken ?? '';
      const list = grouped.get(parentKey) ?? [];
      list.push(node);
      grouped.set(parentKey, list);
    }

    for (const list of grouped.values()) {
      list.sort((left, right) => left.name.localeCompare(right.name));
    }

    return grouped;
  }, [nodes]);

  const nodeByToken = useMemo(() => {
    const lookup = new Map<string, LocalBasementNode>();
    for (const node of nodes) {
      lookup.set(node.pathToken, node);
    }
    return lookup;
  }, [nodes]);

  const visibleNodes = nodesByParent.get(currentPathToken) ?? [];
  const currentNode = currentPathToken ? nodeByToken.get(currentPathToken) ?? null : null;
  const canGoBack = currentPathToken.length > 0;

  const breadcrumbs = splitPath(currentPathToken);

  const handleGoBack = () => {
    if (!currentNode) {
      setCurrentPathToken('');
      return;
    }

    setCurrentPathToken(currentNode.parentPathToken ?? '');
  };

  return (
    <section className="basement-explorer" aria-label="Basement exploration">
      <div className="basement-explorer-header">
        <h3 className="basement-explorer-title">Basement Explorer</h3>
        <p className="basement-explorer-path" aria-live="polite">
          {joinPath(breadcrumbs)}
        </p>
      </div>

      <div className="basement-explorer-toolbar">
        <button
          type="button"
          className="basement-explorer-button"
          onClick={handleGoBack}
          disabled={!canGoBack || isLaunching}
        >
          Back
        </button>
        <button
          type="button"
          className="basement-explorer-button"
          onClick={() => currentNode && onOpenPath(currentNode, 'system-default')}
          disabled={!currentNode || isLaunching}
        >
          Open Current
        </button>
        <button
          type="button"
          className="basement-explorer-button"
          onClick={() => currentNode && onOpenPath(currentNode, 'preferred-editor')}
          disabled={!currentNode || isLaunching}
        >
          Open in Editor
        </button>
      </div>

      {visibleNodes.length === 0 ? (
        <p className="basement-explorer-empty">No subdirectories at this level.</p>
      ) : (
        <ul className="basement-explorer-list">
          {visibleNodes.map((node) => (
            <li key={node.pathToken} className="basement-explorer-item">
              <button
                type="button"
                className="basement-explorer-enter"
                onClick={() => setCurrentPathToken(node.pathToken)}
                disabled={isLaunching}
                aria-label={`Explore ${node.name}`}
              >
                {node.name}
              </button>
              <div className="basement-explorer-actions">
                <button
                  type="button"
                  className="basement-explorer-action"
                  onClick={() => onOpenPath(node, 'system-default')}
                  disabled={isLaunching}
                  aria-label={`Open ${node.name} in default application`}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="basement-explorer-action"
                  onClick={() => onOpenPath(node, 'preferred-editor')}
                  disabled={isLaunching}
                  aria-label={`Open ${node.name} in preferred editor`}
                >
                  Editor
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
