import { describe, expect, it } from 'vitest';
import type { DataScope } from '../types/data-scope';
import { departmentScopeWhere } from './scope';

const globalScope: DataScope = { role: 'administrator', departmentId: null, isGlobal: true };
const pilotScope: DataScope = { role: 'pilot', departmentId: 'dept-prod', isGlobal: false };

describe('departmentScopeWhere', () => {
  it('leaves the base filter untouched for a global scope', () => {
    expect(departmentScopeWhere(globalScope, { status: 'ACTIVE' })).toEqual({ status: 'ACTIVE' });
  });

  it('restricts to the department for a non-global scope', () => {
    expect(departmentScopeWhere(pilotScope, { status: 'ACTIVE' })).toEqual({
      status: 'ACTIVE',
      departmentId: 'dept-prod',
    });
  });

  it('restricts even with no base filter', () => {
    expect(departmentScopeWhere(pilotScope)).toEqual({ departmentId: 'dept-prod' });
  });

  it('passes the base through when scope is undefined', () => {
    expect(departmentScopeWhere(undefined, { status: 'ACTIVE' })).toEqual({ status: 'ACTIVE' });
  });
});
