'use client';

import { useState } from 'react';
import { Building2, ChevronDown, ChevronRight, FileText, Folder, Workflow } from 'lucide-react';
import { cn } from '@tecpap/ui';
import type { DocumentTreeNode } from '@tecpap/types';
import type { LucideIcon } from 'lucide-react';

export interface TreeSelection {
  departmentId?: string;
  processId?: string;
  categoryId?: string;
  label: string;
}

const ICONS: Record<DocumentTreeNode['type'], LucideIcon> = {
  department: Building2,
  process: Workflow,
  category: FileText,
};

export function DocumentTree({
  nodes,
  selection,
  onSelect,
}: {
  nodes: DocumentTreeNode[];
  selection: TreeSelection | null;
  onSelect: (selection: TreeSelection) => void;
}) {
  if (nodes.length === 0) {
    return <p className="px-2 py-4 text-xs text-muted-foreground">No documents yet.</p>;
  }
  return (
    <nav className="space-y-0.5 text-sm" aria-label="Document tree">
      {nodes.map((node) => (
        <TreeNode key={`${node.type}-${node.id}`} node={node} depth={0} selection={selection} onSelect={onSelect} />
      ))}
    </nav>
  );
}

function TreeNode({
  node,
  depth,
  selection,
  onSelect,
}: {
  node: DocumentTreeNode;
  depth: number;
  selection: TreeSelection | null;
  onSelect: (selection: TreeSelection) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const Icon = ICONS[node.type] ?? Folder;
  const hasChildren = !!node.children && node.children.length > 0;

  const isSelected =
    (node.type === 'department' && selection?.departmentId === node.id && !selection?.processId) ||
    (node.type === 'process' && selection?.processId === node.id && !selection?.categoryId) ||
    (node.type === 'category' && selection?.categoryId === node.id);

  const select = () => {
    const next: TreeSelection = { label: node.name };
    if (node.type === 'department') next.departmentId = node.id;
    if (node.type === 'process') {
      next.processId = node.id;
      next.departmentId = undefined;
    }
    if (node.type === 'category') next.categoryId = node.id;
    onSelect(next);
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md py-1 pr-2 transition-colors',
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((value) => !value)}
          className="flex size-5 items-center justify-center text-muted-foreground"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />) : null}
        </button>
        <button type="button" onClick={select} className="flex flex-1 items-center gap-2 truncate text-left">
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{node.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">{node.count}</span>
        </button>
      </div>
      {hasChildren && open ? (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={`${child.type}-${child.id}`} node={child} depth={depth + 1} selection={selection} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
