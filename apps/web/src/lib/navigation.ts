import {
  AlertTriangle,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  FileText,
  FileUp,
  FolderTree,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Lock,
  Package,
  Settings,
  ShieldCheck,
  Star,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
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
      { label: 'Favorites', href: '/favorites', icon: Star },
    ],
  },
  {
    title: 'Quality management',
    items: [
      { label: 'Documents', href: '/documents', icon: FolderTree, permission: 'documents.read' },
      { label: 'Processes', href: '/processes', icon: Workflow, permission: 'processes.read' },
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
    title: 'Operational',
    items: [
      { label: 'Business objects', href: '/business-objects', icon: Package, permission: 'business_objects.read' },
      { label: 'KPIs', href: '/kpis', icon: Gauge, permission: 'kpis.read' },
      { label: 'Risks', href: '/risks', icon: AlertTriangle, permission: 'risks.read' },
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
  {
    title: 'System',
    items: [{ label: 'Settings', icon: Settings, disabled: true }],
  },
];
