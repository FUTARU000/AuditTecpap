/**
 * Phase 4 — operational entities. Business-object types are a configurable
 * catalog (seeded with TECPAP-relevant kinds); administrators add more.
 * Entity types drive the generic relationship engine (entity → entity).
 */

export interface BusinessObjectTypeSeed {
  code: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  sortOrder: number;
}

export const BUSINESS_OBJECT_TYPES: readonly BusinessObjectTypeSeed[] = [
  // Production
  { code: 'PRODUCTION_ORDER', name: 'Production Order', icon: 'Package', color: '#4A3728', description: 'Production work order', sortOrder: 1 },
  { code: 'BATCH', name: 'Production Batch', icon: 'Boxes', color: '#7A5638', description: 'Production batch / lot', sortOrder: 2 },
  { code: 'QUALITY_CHECK', name: 'Quality Check', icon: 'CheckSquare', color: '#2E7D32', description: 'Quality control check', sortOrder: 3 },
  // Commercial
  { code: 'CUSTOMER', name: 'Customer', icon: 'Users', color: '#1565C0', description: 'Customer account', sortOrder: 4 },
  { code: 'PRODUCT_SPEC', name: 'Product Specification', icon: 'FileText', color: '#546E7A', description: 'Product specification', sortOrder: 5 },
  { code: 'COMPLAINT', name: 'Complaint', icon: 'MessageSquareWarning', color: '#C62828', description: 'Customer complaint', sortOrder: 6 },
  // Purchasing
  { code: 'SUPPLIER', name: 'Supplier', icon: 'Truck', color: '#8D6E63', description: 'Supplier / vendor', sortOrder: 7 },
  { code: 'SUPPLIER_EVALUATION', name: 'Supplier Evaluation', icon: 'ClipboardCheck', color: '#A87C58', description: 'Supplier performance evaluation', sortOrder: 8 },
  // Equipment
  { code: 'MACHINE', name: 'Machine', icon: 'Cog', color: '#5C4028', description: 'Equipment / machine', sortOrder: 9 },
  { code: 'MAINTENANCE_PLAN', name: 'Maintenance Plan', icon: 'Wrench', color: '#6B6259', description: 'Preventive maintenance plan', sortOrder: 10 },
  { code: 'CALIBRATION', name: 'Calibration Record', icon: 'Gauge', color: '#4F7A1A', description: 'Calibration record', sortOrder: 11 },
  // Human resources
  { code: 'EMPLOYEE', name: 'Employee', icon: 'User', color: '#3A2A1E', description: 'Employee record', sortOrder: 12 },
  { code: 'COMPETENCY', name: 'Competency', icon: 'GraduationCap', color: '#B8860B', description: 'Competency / skill', sortOrder: 13 },
  { code: 'TRAINING', name: 'Training Session', icon: 'BookOpen', color: '#6FA3C0', description: 'Training session', sortOrder: 14 },
  // Food safety
  { code: 'CLEANING_PROGRAM', name: 'Cleaning Program', icon: 'Sparkles', color: '#2E7D32', description: 'Cleaning & sanitation program', sortOrder: 15 },
  { code: 'PEST_CONTROL', name: 'Pest Control', icon: 'Bug', color: '#948877', description: 'Pest control activity', sortOrder: 16 },
  { code: 'ENVIRONMENTAL_MONITORING', name: 'Environmental Monitoring', icon: 'Leaf', color: '#5B8A1E', description: 'Environmental monitoring sample', sortOrder: 17 },
];

/** Entity kinds the relationship engine can link. */
export const ENTITY_TYPES = [
  'process',
  'business_object',
  'document',
  'kpi',
  'risk',
  'audit',
  'finding',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  process: 'Process',
  business_object: 'Business object',
  document: 'Document',
  kpi: 'KPI',
  risk: 'Risk',
  audit: 'Audit',
  finding: 'Finding',
};

/** Generic relationship types between any two entities. */
export const RELATIONSHIP_TYPES = ['USES', 'GENERATES', 'REFERENCES', 'REPLACES', 'ATTACHMENT'] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const KPI_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type KpiFrequency = (typeof KPI_FREQUENCIES)[number];

export const PROCESS_ROLES = ['OWNER', 'APPROVER', 'OPERATOR', 'AUDITOR', 'MANAGER'] as const;
export type ProcessRole = (typeof PROCESS_ROLES)[number];

export const PROCESS_ROLE_LABELS: Record<ProcessRole, string> = {
  OWNER: 'Owner',
  APPROVER: 'Approver',
  OPERATOR: 'Operator',
  AUDITOR: 'Auditor',
  MANAGER: 'Manager',
};
