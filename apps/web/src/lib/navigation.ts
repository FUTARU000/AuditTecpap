import {
  BarChart3,
  Bookmark,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  FileText,
  FileUp,
  FolderTree,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Lock,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.read' }],
  },
  {
    title: 'Productivity',
    items: [
      { label: 'Workspace', href: '/workspace', icon: LayoutGrid },
      { label: 'Tasks', href: '/tasks', icon: ListTodo },
      { label: 'Calendar', href: '/calendar', icon: Calendar },
      { label: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
    ],
  },
  {
    title: 'Quality management',
    items: [
      { label: 'Documents', href: '/documents', icon: FolderTree, permission: 'documents.read' },
      { label: 'Document insights', href: '/documents/insights', icon: BarChart3, permission: 'documents.read' },
    ],
  },
  {
    title: 'Audit programme',
    items: [
      { label: 'Templates', href: '/audit-templates', icon: ClipboardList, permission: 'templates.read' },
      { label: 'Audits', href: '/audits', icon: ClipboardCheck, permission: 'audits.read' },
      { label: 'CAPA', href: '/capas', icon: Wrench, permission: 'capas.read' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users, permission: 'users.read' },
      { label: 'Roles', href: '/admin/roles', icon: ShieldCheck, permission: 'roles.read' },
      { label: 'Permissions', href: '/admin/permissions', icon: Lock, permission: 'permissions.read' },
      { label: 'Departments', href: '/admin/departments', icon: Building2, permission: 'departments.read' },
      { label: 'Categories', href: '/admin/categories', icon: FileText, permission: 'categories.read' },
      { label: 'Audit log', href: '/admin/audit-log', icon: FileStack, permission: 'audit-log.read' },
      { label: 'Import', href: '/import', icon: FileUp, permission: 'imports.read' },
    ],
  },
];
