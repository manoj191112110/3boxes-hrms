'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  FiShield, FiUsers, FiLock, FiPlus, FiEdit2, FiEye, FiTrash2,
  FiX, FiSearch, FiRefreshCw, FiGrid, FiCheck, FiChevronDown,
  FiChevronRight, FiUserCheck, FiDatabase, FiAlertTriangle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { isTenantHiddenClient, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';

// ─── Auth Headers ──────────────────────────────────────────
const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// ─── Interfaces ────────────────────────────────────────────
interface RolePermissionItem {
  id: string;
  granted: boolean;
  permission: {
    id: string;
    action: string;
    module: { id: string; key: string; name: string; category: string };
  };
}

interface Role {
  id: string;
  name: string;
  key: string;
  description: string | null;
  isSystem: boolean;
  level: number;
  tenantId: string | null;
  companyId: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  tenant?: { id: string; name: string; slug: string } | null;
  company?: { id: string; name: string; code: string | null } | null;
  permissions: RolePermissionItem[];
  _count?: { userRoles: number };
}

interface ModulePermission {
  id: string;
  action: string;
}

interface Module {
  id: string;
  key: string;
  name: string;
  category: string;
  icon: string | null;
  sortOrder: number;
  permissions: ModulePermission[];
}

interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar: string | null;
  tenantId: string;
  tenant?: { id: string; name: string; slug: string } | null;
  employee?: { id: string; firstName: string; lastName: string; companyId: string | null } | null;
  roleAssignments: {
    id: string;
    companyId: string | null;
    role: { id: string; name: string; key: string; level: number; isSystem: boolean; companyId: string | null };
  }[];
}

// ─── Badge Helpers ─────────────────────────────────────────
const levelBadgeCls: Record<number, string> = {
  0: 'bg-amber-50 text-amber-700 border border-amber-200 thb-badge',
  1: 'thb-badge thb-badge-primary',
  2: 'thb-badge thb-badge-purple',
  3: 'thb-badge thb-badge-info',
  4: 'thb-badge thb-badge-success',
  5: 'thb-badge thb-badge-warning',
};

const levelLabel: Record<number, string> = {
  0: 'Super Admin',
  1: 'Tenant Admin',
  2: 'HR Admin',
  3: 'Manager',
  4: 'Employee',
  5: 'Custom',
};

// ─── Main Component ────────────────────────────────────────
export default function SuperAdminRBACPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'users'>('roles');
  const formRef = useRef<HTMLDivElement>(null);

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleSearch, setRoleSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');

  // Inline form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingRole, setViewingRole] = useState<Role | null>(null);
  const [submittingRole, setSubmittingRole] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '', key: '', description: '', level: 5, tenantId: '', companyId: '',
  });

  // Modules/Permissions state
  const [modules, setModules] = useState<Module[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Users state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userTenantFilter, setUserTenantFilter] = useState('');
  const [userCompanyFilter, setUserCompanyFilter] = useState('');
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignCompanyId, setAssignCompanyId] = useState('');

  // Seed state
  const [seeding, setSeeding] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Tenants for filter
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);

  // ─── Data Fetching ──────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    try {
      setError(null);
      setRolesLoading(true);
      const params = new URLSearchParams();
      params.set('_t', Date.now().toString()); // Cache bust
      if (roleSearch) params.set('search', roleSearch);
      if (tenantFilter) params.set('tenantId', tenantFilter);
      const res = await fetch(`/api/rbac/roles?${params.toString()}`, { headers: getAuthHeaders(), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        // Filter out roles belonging to hidden tenants
        const visibleRoles = (data.roles || []).filter((r: Role) => {
          if (!r.tenant) return true; // Global roles always visible
          return !isTenantHiddenClient(r.tenant.slug) && !(r.tenant.name || '').includes(PLATFORM_PLACEHOLDER_NAME);
        });
        setRoles(visibleRoles);
        if (data.needsSeed) {
          toast('RBAC tables not found. Click "Seed RBAC Data" to initialize.', { icon: '⚠️', duration: 5000 });
        }
      } else {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.error || `Failed to load roles (status ${res.status})`;
        toast.error(errorMsg);
        setError(errorMsg);
      }
    } catch {
      toast.error('Failed to load roles');
      setError('Failed to load roles. The database tables may not exist yet.');
    }
    finally { setRolesLoading(false); }
  }, [roleSearch, tenantFilter]);

  const fetchModules = useCallback(async () => {
    try {
      setError(null);
      setModulesLoading(true);
      const res = await fetch('/api/rbac/modules', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
        // Expand all categories by default
        const cats = [...new Set((data.modules || []).map((m: Module) => m.category))];
        const exp: Record<string, boolean> = {};
        cats.forEach((c) => { exp[c as string] = true; });
        setExpandedCategories(exp);
      }
    } catch {
      toast.error('Failed to load modules');
      setError('Failed to load modules. The database tables may not exist yet.');
    }
    finally { setModulesLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      setUsersLoading(true);
      const params = new URLSearchParams();
      if (userTenantFilter) params.set('tenantId', userTenantFilter);
      if (userSearch) params.set('search', userSearch);
      const res = await fetch(`/api/rbac/user-roles?${params.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        let userList: UserWithRoles[] = data.users || [];
        // Filter out users belonging to hidden/demo tenants
        userList = userList.filter((u: UserWithRoles) => {
          if (!u.tenant) return true;
          return !isTenantHiddenClient(u.tenant.slug) && !(u.tenant.name || '').includes(PLATFORM_PLACEHOLDER_NAME);
        });
        if (userCompanyFilter) {
          userList = userList.filter((u: UserWithRoles) =>
            u.roleAssignments.some((ra) => ra.companyId === userCompanyFilter || ra.companyId === null)
          );
        }
        setUsers(userList);
      }
    } catch {
      toast.error('Failed to load users');
      setError('Failed to load users. The database tables may not exist yet.');
    }
    finally { setUsersLoading(false); }
  }, [userTenantFilter, userCompanyFilter, userSearch]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/tenants?limit=100', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const all = Array.isArray(data) ? data : data.tenants || [];
        // ALWAYS filter out hidden tenants — never show Marq AI Tech or demo
        const visible = all.filter((t: { slug: string; name?: string }) =>
          !isTenantHiddenClient(t.slug) && !(t.name || '').includes(PLATFORM_PLACEHOLDER_NAME)
        );
        setTenants(visible);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchTenants()); }, [fetchTenants]);

  useEffect(() => {
    if (activeTab === 'roles') queueMicrotask(() => fetchRoles());
  }, [activeTab, fetchRoles]);

  useEffect(() => {
    if (activeTab === 'permissions') queueMicrotask(() => fetchModules());
  }, [activeTab, fetchModules]);

  useEffect(() => {
    if (activeTab === 'users') queueMicrotask(() => fetchUsers());
  }, [activeTab, fetchUsers]);

  // Scroll to form
  useEffect(() => {
    if (showRoleForm || viewingId) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [showRoleForm, viewingId]);

  // ─── Role Handlers ──────────────────────────────────────
  const handleViewRole = async (id: string) => {
    try {
      const res = await fetch(`/api/rbac/roles/${id}/permissions`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingRole(data.role);
        setViewingId(id);
        setShowRoleForm(false);
        setEditingRoleId(null);
      }
    } catch { toast.error('Failed to load role details'); }
  };

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setShowRoleForm(true);
    setViewingId(null);
    setViewingRole(null);
    setRoleForm({
      name: role.name, key: role.key, description: role.description || '',
      level: role.level, tenantId: role.tenantId || '', companyId: role.companyId || '',
    });
  };

  const handleCancelForm = () => {
    setShowRoleForm(false);
    setEditingRoleId(null);
    setRoleForm({ name: '', key: '', description: '', level: 5, tenantId: '', companyId: '' });
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name || !roleForm.key) { toast.error('Name and key are required'); return; }
    setSubmittingRole(true);
    try {
      const url = editingRoleId ? `/api/rbac/roles/${editingRoleId}` : '/api/rbac/roles';
      const method = editingRoleId ? 'PATCH' : 'POST';
      const body = editingRoleId
        ? { name: roleForm.name, description: roleForm.description, level: roleForm.level }
        : {
            name: roleForm.name, key: roleForm.key, description: roleForm.description,
            level: roleForm.level, tenantId: roleForm.tenantId || null,
            companyId: roleForm.companyId || null, isSystem: false, createdBy: user?.id,
          };
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success(editingRoleId ? 'Role updated' : 'Role created');
      handleCancelForm();
      // Re-fetch immediately AND after a delay to ensure database commit is visible
      fetchRoles();
      setTimeout(() => fetchRoles(), 1500);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed'); }
    finally { setSubmittingRole(false); }
  };

  const handleDeleteRole = async (id: string) => {
    try {
      const res = await fetch(`/api/rbac/roles/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Role deleted');
      setDeleteConfirmId(null);
      fetchRoles();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
  };

  // ─── Permission Matrix Handlers ─────────────────────────
  const handleSelectRole = async (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      const overrides: Record<string, boolean> = {};
      role.permissions.forEach((rp) => {
        overrides[rp.permission.id] = rp.granted;
      });
      setPermissionOverrides(overrides);
    }
  };

  const handleTogglePermission = (permissionId: string) => {
    setPermissionOverrides((prev) => ({
      ...prev,
      [permissionId]: !prev[permissionId],
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;
    setSavingPermissions(true);
    try {
      const permissions = Object.entries(permissionOverrides).map(([permissionId, granted]) => ({
        permissionId, granted,
      }));
      const res = await fetch(`/api/rbac/roles/${selectedRoleId}/permissions`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ permissions }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Permissions updated');
      fetchRoles();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to save permissions'); }
    finally { setSavingPermissions(false); }
  };

  const handleToggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // ─── User Assignment Handlers ───────────────────────────
  const handleAssignRole = async () => {
    if (!assigningUserId || !assignRoleId) { toast.error('Select a role'); return; }
    try {
      const res = await fetch(`/api/rbac/roles/${assignRoleId}/assign`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: assigningUserId,
          companyId: assignCompanyId || null,
          assignedBy: user?.id,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Role assigned');
      setAssigningUserId(null);
      setAssignRoleId('');
      setAssignCompanyId('');
      fetchUsers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Assignment failed'); }
  };

  const handleRevokeRole = async (userId: string, roleId: string, companyId: string | null) => {
    try {
      const res = await fetch(`/api/rbac/roles/${roleId}/assign`, {
        method: 'DELETE', headers: getAuthHeaders(),
        body: JSON.stringify({ userId, companyId }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Role revoked');
      fetchUsers();
    } catch { toast.error('Failed to revoke role'); }
  };

  // ─── Seed ───────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/rbac/seed', { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) { 
        const d = await res.json(); 
        const errMsg = d.details ? `${d.error}: ${d.details}` : (d.error || 'Failed');
        throw new Error(errMsg); 
      }
      const data = await res.json();
      toast.success(data.message || 'RBAC data seeded');
      fetchRoles();
      fetchModules();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Seed failed'); }
    finally { setSeeding(false); }
  };

  // ─── Input helpers ──────────────────────────────────────
  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';
  const labelCls = 'block text-xs font-medium text-thb-text-secondary mb-1';
  const selectCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white';
  const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/25 rounded-lg font-medium text-sm transition-colors disabled:opacity-50';
  const btnSecondary = 'px-4 py-2 text-sm font-medium text-thb-text-secondary bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors';

  // ─── Error UI ───────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <FiAlertTriangle className="w-16 h-16 text-red-400" />
        <h2 className="text-xl font-semibold text-thb-text-primary">Something went wrong</h2>
        <p className="text-thb-text-secondary text-center max-w-md">{error}</p>
        <button onClick={() => { setError(null); fetchRoles(); fetchModules(); }} className={btnPrimary}>
          <FiRefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  // ─── Access Guard ───────────────────────────────────────
  if (user?.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <FiShield className="w-16 h-16 text-thb-text-muted" />
        <h2 className="text-xl font-semibold text-thb-text-primary">Access Restricted</h2>
        <p className="text-thb-text-secondary">This page is only accessible to Super Admins.</p>
      </div>
    );
  }

  // ─── Grouped modules ────────────────────────────────────
  const categories = [...new Set(modules.map((m) => m.category))];
  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // ═════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiShield className="w-6 h-6 text-amber-500" />
            RBAC Management
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage roles, permissions, and user access across the platform</p>
        </div>
        <button onClick={handleSeed} disabled={seeding} className={btnPrimary}>
          <FiDatabase className="w-4 h-4" />
          {seeding ? 'Seeding...' : 'Seed RBAC Data'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit overflow-x-auto">
        {[
          { key: 'roles' as const, label: 'Roles', icon: <FiLock className="w-4 h-4" /> },
          { key: 'permissions' as const, label: 'Permissions Matrix', icon: <FiGrid className="w-4 h-4" /> },
          { key: 'users' as const, label: 'User Assignments', icon: <FiUserCheck className="w-4 h-4" /> },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-white shadow-sm text-thb-text-primary' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: ROLES ═══ */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <input type="text" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search roles..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
            </div>
            <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} className={selectCls + ' sm:w-48'}>
              <option value="">All Tenants</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {!showRoleForm && (
              <button onClick={() => { setShowRoleForm(true); setEditingRoleId(null); setRoleForm({ name: '', key: '', description: '', level: 5, tenantId: '', companyId: '' }); }} className={btnPrimary}>
                <FiPlus className="w-4 h-4" /> Add Role
              </button>
            )}
          </div>

          {/* View Panel */}
          {viewingId && viewingRole && (
            <div ref={formRef} className="thb-card border-l-4 border-l-emerald-500 p-6 animate-slide-in-down">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiEye className="w-5 h-5 text-emerald-500" /> Role Details
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => handleEditRole(viewingRole)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100">
                    <FiEdit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => { setViewingId(null); setViewingRole(null); }} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg">
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div><p className="text-xs text-thb-text-muted">Name</p><p className="text-sm font-medium text-thb-text-primary">{viewingRole.name}</p></div>
                <div><p className="text-xs text-thb-text-muted">Key</p><p className="text-sm font-mono text-thb-text-primary">{viewingRole.key}</p></div>
                <div><p className="text-xs text-thb-text-muted">Level</p><span className={levelBadgeCls[viewingRole.level] || levelBadgeCls[5]}>{levelLabel[viewingRole.level] || `Level ${viewingRole.level}`}</span></div>
                <div><p className="text-xs text-thb-text-muted">Status</p><span className="thb-badge thb-badge-success">{viewingRole.status}</span></div>
                <div><p className="text-xs text-thb-text-muted">System Role</p><span className={viewingRole.isSystem ? 'thb-badge thb-badge-warning' : 'thb-badge thb-badge-info'}>{viewingRole.isSystem ? 'Yes' : 'No'}</span></div>
                <div><p className="text-xs text-thb-text-muted">Tenant</p><p className="text-sm text-thb-text-primary">{viewingRole.tenant?.name || 'Global'}</p></div>
                <div><p className="text-xs text-thb-text-muted">Company</p><p className="text-sm text-thb-text-primary">{viewingRole.company?.name || 'All Companies'}</p></div>
                <div><p className="text-xs text-thb-text-muted">Users</p><p className="text-sm text-thb-text-primary">{viewingRole._count?.userRoles || 0}</p></div>
              </div>
              {viewingRole.description && (
                <div className="mb-4"><p className="text-xs text-thb-text-muted">Description</p><p className="text-sm text-thb-text-secondary">{viewingRole.description}</p></div>
              )}
              {/* Permissions Summary */}
              <div>
                <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Permission Summary</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {(() => {
                    const permByModule: Record<string, string[]> = {};
                    viewingRole.permissions.forEach((rp) => {
                      const modName = rp.permission.module.name;
                      if (!permByModule[modName]) permByModule[modName] = [];
                      permByModule[modName].push(rp.permission.action);
                    });
                    return Object.entries(permByModule).map(([mod, actions]) => (
                      <div key={mod} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-thb-text-primary w-32">{mod}</span>
                        <div className="flex gap-1 flex-wrap">
                          {actions.map((a) => <span key={a} className="thb-badge thb-badge-success text-[10px]">{a}</span>)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Form */}
          {showRoleForm && (
            <div ref={formRef} className="thb-card border-l-4 border-l-green-500 p-6 animate-slide-in-down">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-thb-text-primary">{editingRoleId ? 'Edit Role' : 'Create Role'}</h3>
                <button onClick={handleCancelForm} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleSubmitRole} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className={labelCls}>Name *</label><input required value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className={inputCls} placeholder="Role name" /></div>
                  <div><label className={labelCls}>Key *</label><input required value={roleForm.key} onChange={(e) => setRoleForm({ ...roleForm, key: e.target.value })} className={inputCls} placeholder="role_key" disabled={!!editingRoleId} /></div>
                  <div><label className={labelCls}>Level</label>
                    <select value={roleForm.level} onChange={(e) => setRoleForm({ ...roleForm, level: parseInt(e.target.value) })} className={selectCls}>
                      {[0, 1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{levelLabel[l] || `Level ${l}`}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Tenant</label>
                    <select value={roleForm.tenantId} onChange={(e) => setRoleForm({ ...roleForm, tenantId: e.target.value })} className={selectCls}>
                      <option value="">Global (All Tenants)</option>
                      {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2"><label className={labelCls}>Description</label><input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className={inputCls} placeholder="Role description" /></div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={handleCancelForm} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={submittingRole} className={btnPrimary}>{submittingRole ? 'Saving...' : editingRoleId ? 'Update Role' : 'Create Role'}</button>
                </div>
              </form>
            </div>
          )}

          {/* Roles Table */}
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Level</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Scope</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Users</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Permissions</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rolesLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-12 bg-slate-200 rounded-full" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-8 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-10 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                      </tr>
                    ))
                  ) : roles.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center">
                      <FiLock className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No roles found</p>
                      <p className="text-xs text-thb-text-muted mt-1">Click &quot;Seed RBAC Data&quot; to initialize default roles</p>
                    </td></tr>
                  ) : (
                    roles.map((role) => (
                      <tr key={role.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                        {deleteConfirmId === role.id ? (
                          <td colSpan={7} className="px-4 py-3 bg-red-50">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-red-700 font-medium flex items-center gap-2"><FiAlertTriangle className="w-4 h-4" />Delete role &quot;{role.name}&quot;?</span>
                              <div className="flex gap-2">
                                <button onClick={() => handleDeleteRole(role.id)} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600">Confirm</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-thb-text-primary">{role.name}</p>
                              <p className="text-xs text-thb-text-muted font-mono">{role.key}</p>
                            </td>
                            <td className="px-4 py-3"><span className={levelBadgeCls[role.level] || levelBadgeCls[5]}>{levelLabel[role.level] || `L${role.level}`}</span></td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary">
                              {role.tenant?.name || 'Global'}{role.company ? ` / ${role.company.name}` : ''}
                            </td>
                            <td className="px-4 py-3"><span className={role.isSystem ? 'thb-badge thb-badge-warning' : 'thb-badge thb-badge-info'}>{role.isSystem ? 'System' : 'Custom'}</span></td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary">{role._count?.userRoles || 0}</td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary">{role.permissions.length}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleViewRole(role.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
                                <button onClick={() => handleEditRole(role)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                                {!role.isSystem && (
                                  <button onClick={() => setDeleteConfirmId(role.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: PERMISSIONS MATRIX ═══ */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {/* Role Selector */}
          <div className="thb-card p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <FiShield className="w-4 h-4 text-thb-text-muted" />
                <span className="text-sm font-medium text-thb-text-primary">Select Role:</span>
              </div>
              <select value={selectedRoleId || ''} onChange={(e) => handleSelectRole(e.target.value)} className={selectCls + ' sm:w-64'}>
                <option value="">— Choose a role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({levelLabel[r.level] || `L${r.level}`}) {r.isSystem ? '★' : ''}
                  </option>
                ))}
              </select>
              {selectedRoleId && (
                <button onClick={handleSavePermissions} disabled={savingPermissions} className={btnPrimary}>
                  <FiCheck className="w-4 h-4" /> {savingPermissions ? 'Saving...' : 'Save Permissions'}
                </button>
              )}
              <button onClick={() => fetchRoles()} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors" title="Refresh">
                <FiRefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedRole && selectedRole.isSystem && selectedRole.key === 'super_admin' && (
            <div className="thb-card p-4 bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-700 flex items-center gap-2"><FiAlertTriangle className="w-4 h-4" /> Super Admin has all permissions and cannot be modified.</p>
            </div>
          )}

          {selectedRoleId && (!selectedRole?.isSystem || selectedRole.key !== 'super_admin') && (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-thb-border bg-slate-50/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider sticky left-0 bg-slate-50 z-10 min-w-[180px]">Module</th>
                      {['view', 'create', 'edit', 'delete', 'export', 'approve'].map((action) => (
                        <th key={action} className="text-center px-3 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider min-w-[70px]">{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modulesLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                          <td className="px-4 py-3"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-3 py-3"><div className="h-5 w-5 bg-slate-100 rounded mx-auto" /></td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      categories.map((cat) => (
                        <PermissionCategoryRow
                          key={cat}
                          category={cat}
                          modules={modules.filter((m) => m.category === cat)}
                          expanded={expandedCategories[cat] !== false}
                          onToggle={() => handleToggleCategory(cat)}
                          permissionOverrides={permissionOverrides}
                          onTogglePermission={handleTogglePermission}
                          disabled={savingPermissions}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!selectedRoleId && !modulesLoading && (
            <div className="thb-card p-12 text-center">
              <FiGrid className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">Select a role to manage permissions</p>
              <p className="text-xs text-thb-text-muted mt-1">Choose a role from the dropdown above to view and edit its permission matrix</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 3: USER ASSIGNMENTS ═══ */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
            </div>
            <select value={userTenantFilter} onChange={(e) => setUserTenantFilter(e.target.value)} className={selectCls + ' sm:w-48'}>
              <option value="">All Tenants</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={userCompanyFilter} onChange={(e) => setUserCompanyFilter(e.target.value)} className={selectCls + ' sm:w-48'}>
              <option value="">All Companies</option>
              {tenants.flatMap((t) => (t as unknown as { companyGroups?: { companies: { id: string; name: string }[] }[] }).companyGroups?.flatMap((cg) => cg.companies || []) || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* User Assignments Table */}
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Default Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Assigned Roles</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center">
                      <FiUsers className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No users found</p>
                    </td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {u.name?.[0] || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-thb-text-primary">{u.name}</p>
                              <p className="text-xs text-thb-text-muted">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{u.tenant?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={levelBadgeCls[
                            { super_admin: 0, tenant_admin: 1, hr_admin: 2, manager: 3, employee: 4 }[u.role] ?? 5
                          ] || levelBadgeCls[5]}>{u.role}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roleAssignments.length === 0 && <span className="text-xs text-thb-text-muted">No extra roles</span>}
                            {u.roleAssignments.map((ra) => (
                              <span key={ra.id} className="thb-badge thb-badge-purple text-[10px] flex items-center gap-1">
                                {ra.role.name}
                                {ra.companyId && <span className="text-[9px] opacity-70">(company)</span>}
                                <button onClick={() => handleRevokeRole(u.id, ra.role.id, ra.companyId)}
                                  className="ml-0.5 hover:text-red-500 transition-colors"><FiX className="w-3 h-3" /></button>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {assigningUserId === u.id ? (
                              <div className="flex items-center gap-2">
                                <select value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)} className="text-xs px-2 py-1.5 rounded border border-thb-border bg-white">
                                  <option value="">Select role</option>
                                  {roles.filter((r) => !r.isSystem || r.key !== 'super_admin').map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                                <button onClick={handleAssignRole} className="px-2 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600">Assign</button>
                                <button onClick={() => { setAssigningUserId(null); setAssignRoleId(''); }} className="px-2 py-1.5 text-xs border border-thb-border rounded hover:bg-slate-50">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setAssigningUserId(u.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Assign Role">
                                <FiPlus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Permission Category Row Sub-component ────────────────
function PermissionCategoryRow({
  category,
  modules,
  expanded,
  onToggle,
  permissionOverrides,
  onTogglePermission,
  disabled,
}: {
  category: string;
  modules: Module[];
  expanded: boolean;
  onToggle: () => void;
  permissionOverrides: Record<string, boolean>;
  onTogglePermission: (id: string) => void;
  disabled: boolean;
}) {
  const actions = ['view', 'create', 'edit', 'delete', 'export', 'approve'];

  return (
    <>
      <tr className="bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td colSpan={7} className="px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-thb-text-primary">
            {expanded ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
            {category}
            <span className="text-xs font-normal text-thb-text-muted">({modules.length} modules)</span>
          </div>
        </td>
      </tr>
      {expanded && modules.map((mod) => (
        <tr key={mod.id} className="border-b border-thb-border/50 hover:bg-slate-50/30 transition-colors">
          <td className="px-4 py-2.5 sticky left-0 bg-white z-10">
            <span className="text-sm text-thb-text-primary pl-4">{mod.name}</span>
          </td>
          {actions.map((action) => {
            const perm = mod.permissions.find((p) => p.action === action);
            const isOn = perm ? (permissionOverrides[perm.id] ?? false) : false;
            return (
              <td key={action} className="px-3 py-2.5 text-center">
                {perm ? (
                  <button
                    onClick={() => !disabled && onTogglePermission(perm.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isOn ? 'bg-green-500' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                ) : (
                  <span className="text-thb-text-muted text-xs">—</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
