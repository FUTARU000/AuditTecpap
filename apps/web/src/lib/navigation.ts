import {
  Award,
  Building2,
  ClipboardCheck,
  FileBarChart,
  FileStack,
  FlagTriangleRight,
  LayoutDashboard,
  ListChecks,
  Lock,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  /** Disabled items are placeholders for upcoming phases. */
  disabled?: boolean;
  /** Required permission key to see this item (hidden if the user lacks it). */
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
    title: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users, permission: 'users.read' },
      { label: 'Roles', href: '/admin/roles', icon: ShieldCheck, permission: 'roles.read' },
      { label: 'Permissions', href: '/admin/permissions', icon: Lock, permission: 'permissions.read' },
      { label: 'Departments', href: '/admin/departments', icon: Building2, permission: 'departments.read' },
      { label: 'Audit log', href: '/admin/audit-log', icon: FileBarChart, permission: 'audit-log.read' },
    ],
  },
  {
    title: 'Audit programme',
    items: [
      { label: 'Audits', icon: ClipboardCheck, disabled: true },
      { label: 'Templates', icon: FileStack, disabled: true },
      { label: 'Findings', icon: FlagTriangleRight, disabled: true },
      { label: 'Corrective actions', icon: ListChecks, disabled: true },
    ],
  },
  {
    title: 'Document control',
    items: [
      { label: 'Documents', icon: FileBarChart, disabled: true },
      { label: 'Certificates', icon: Award, disabled: true },
    ],
  },
  {
    title: 'System',
    items: [{ label: 'Settings', icon: Settings, disabled: true }],
  },
];
