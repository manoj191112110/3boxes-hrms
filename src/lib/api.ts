// API helper functions for 3Boxes HRMS
import type { UserRole } from '@/lib/types';

const API_BASE = '/api';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Generic fetch helper
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ==================== AUTH ====================
export async function loginApi(email: string, password: string) {
  return apiFetch<{
    user: { id: string; email: string; name: string; role: string; companyId: string | null; avatar: string | null };
    employee: { id: string; employeeId: string; firstName: string; lastName: string } | null;
    company: { id: string; name: string; code: string; industry: string | null; country: string | null; currency: string } | null;
  }>('/auth', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ==================== DASHBOARD ====================
export async function getDashboardStats(companyId?: string) {
  const params = companyId ? `?companyId=${companyId}` : '';
  return apiFetch<{
    totalEmployees: number;
    activeEmployees: number;
    newHires: number;
    openPositions: number;
    attritionRate: number;
    attendanceRate: number;
    pendingApprovals: number;
    departmentDistribution: { name: string; value: number; color: string }[];
    recentActivities: { id: string; action: string; entity: string; details: string; createdAt: string }[];
  }>(`/dashboard${params}`);
}

// ==================== EMPLOYEES ====================
export async function getEmployees(params?: { search?: string; departmentId?: string; status?: string; companyId?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch<PaginatedResponse<{
    id: string; employeeId: string; firstName: string; lastName: string; email: string; phone: string | null;
    designation: string; jobTitle: string | null; employmentType: string; status: string; joiningDate: string;
    department: { id: string; name: string }; branch: { id: string; name: string } | null; company: { id: string; name: string };
  }>>(`/employees?${query.toString()}`);
}

export async function createEmployee(data: Record<string, unknown>) {
  return apiFetch('/employees', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEmployee(id: string, data: Record<string, unknown>) {
  return apiFetch('/employees', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== JOBS ====================
export async function getJobs(params?: { status?: string; companyId?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch<PaginatedResponse<{
    id: string; title: string; department: string | null; location: string | null; employmentType: string | null;
    status: string; priority: string; positions: number; filledPositions: number; _count: { candidates: number };
    postedDate: string | null; closingDate: string | null;
  }>>(`/jobs?${query.toString()}`);
}

export async function createJob(data: Record<string, unknown>) {
  return apiFetch('/jobs', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateJob(id: string, data: Record<string, unknown>) {
  return apiFetch('/jobs', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== CANDIDATES ====================
export async function getCandidates(params?: { jobId?: string; status?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/candidates?' + query.toString());
}

export async function createCandidate(data: Record<string, unknown>) {
  return apiFetch('/candidates', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCandidate(id: string, data: Record<string, unknown>) {
  return apiFetch('/candidates', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== INTERVIEWS ====================
export async function getInterviews(params?: { candidateId?: string; jobId?: string; status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/interviews?' + query.toString());
}

export async function createInterview(data: Record<string, unknown>) {
  return apiFetch('/interviews', { method: 'POST', body: JSON.stringify(data) });
}

// ==================== ATTENDANCE ====================
export async function getAttendance(params?: { employeeId?: string; date?: string; startDate?: string; endDate?: string; status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/attendance?' + query.toString());
}

export async function checkIn(employeeId: string, source: string = 'web') {
  return apiFetch('/attendance', { method: 'POST', body: JSON.stringify({ employeeId, source }) });
}

export async function checkOut(id: string) {
  return apiFetch('/attendance', { method: 'PUT', body: JSON.stringify({ id, action: 'checkout' }) });
}

// ==================== LEAVES ====================
export async function getLeaves(params?: { employeeId?: string; status?: string; type?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/leaves?' + query.toString());
}

export async function applyLeave(data: Record<string, unknown>) {
  return apiFetch('/leaves', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLeave(id: string, data: Record<string, unknown>) {
  return apiFetch('/leaves', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

export async function approveRejectLeave(id: string, action: 'approve' | 'reject', comments?: string) {
  return apiFetch('/leaves', { method: 'PATCH', body: JSON.stringify({ id, action, comments }) });
}

// ==================== PAYROLL ====================
export async function getPayroll(params?: { month?: number; year?: number; status?: string; employeeId?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, String(v)); });
  return apiFetch('/payroll?' + query.toString());
}

export async function createPayroll(data: Record<string, unknown>) {
  return apiFetch('/payroll', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePayroll(id: string, data: Record<string, unknown>) {
  return apiFetch('/payroll', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== GOALS ====================
export async function getGoals(params?: { employeeId?: string; status?: string; type?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/goals?' + query.toString());
}

export async function createGoal(data: Record<string, unknown>) {
  return apiFetch('/goals', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateGoal(id: string, data: Record<string, unknown>) {
  return apiFetch('/goals', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== ASSETS ====================
export async function getAssets(params?: { employeeId?: string; status?: string; assetType?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/assets?' + query.toString());
}

export async function createAsset(data: Record<string, unknown>) {
  return apiFetch('/assets', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAsset(id: string, data: Record<string, unknown>) {
  return apiFetch('/assets', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== TRAVEL ====================
export async function getTravelRequests(params?: { employeeId?: string; status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/travel?' + query.toString());
}

export async function createTravelRequest(data: Record<string, unknown>) {
  return apiFetch('/travel', { method: 'POST', body: JSON.stringify(data) });
}

export async function approveRejectTravel(id: string, action: 'approve' | 'reject', comments?: string) {
  return apiFetch('/travel', { method: 'PATCH', body: JSON.stringify({ id, action, comments }) });
}

// ==================== EXPENSES ====================
export async function getExpenses(params?: { employeeId?: string; status?: string; type?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/expenses?' + query.toString());
}

export async function createExpense(data: Record<string, unknown>) {
  return apiFetch('/expenses', { method: 'POST', body: JSON.stringify(data) });
}

export async function approveRejectExpense(id: string, action: 'approve' | 'reject', comments?: string) {
  return apiFetch('/expenses', { method: 'PATCH', body: JSON.stringify({ id, action, comments }) });
}

// ==================== LEARNING ====================
export async function getLearningRecords(params?: { employeeId?: string; status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/learning?' + query.toString());
}

export async function createLearningRecord(data: Record<string, unknown>) {
  return apiFetch('/learning', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLearningRecord(id: string, data: Record<string, unknown>) {
  return apiFetch('/learning', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== TICKETS ====================
export async function getTickets(params?: { category?: string; priority?: string; status?: string; employeeId?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/tickets?' + query.toString());
}

export async function createTicket(data: Record<string, unknown>) {
  return apiFetch('/tickets', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTicket(id: string, data: Record<string, unknown>) {
  return apiFetch('/tickets', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== CLIENTS ====================
export async function getClients(params?: { status?: string; companyId?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/clients?' + query.toString());
}

export async function createClient(data: Record<string, unknown>) {
  return apiFetch('/clients', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateClient(id: string, data: Record<string, unknown>) {
  return apiFetch('/clients', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== VENDORS ====================
export async function getVendors(params?: { status?: string; serviceType?: string; companyId?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/vendors?' + query.toString());
}

export async function createVendor(data: Record<string, unknown>) {
  return apiFetch('/vendors', { method: 'POST', body: JSON.stringify(data) });
}

// ==================== COMPANIES ====================
export async function getCompanies() {
  return apiFetch<{ id: string; name: string; code: string; industry: string | null; country: string | null; currency: string; isActive: boolean; _count: { employees: number } }[]>('/companies');
}

export async function createCompany(data: Record<string, unknown>) {
  return apiFetch('/companies', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCompany(id: string, data: Record<string, unknown>) {
  return apiFetch('/companies', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== NOTIFICATIONS ====================
export async function getNotifications(userId: string) {
  return apiFetch<{ notifications: { id: string; title: string; message: string; type: string; category: string; isRead: boolean; createdAt: string; actionUrl: string | null }[]; unreadCount: number }>(`/notifications?userId=${userId}`);
}

export async function markNotificationRead(id: string) {
  return apiFetch('/notifications', { method: 'PATCH', body: JSON.stringify({ id }) });
}

export async function clearNotifications(userId: string) {
  return apiFetch(`/notifications?userId=${userId}`, { method: 'DELETE' });
}

// ==================== WORKFLOWS ====================
export async function getWorkflows(params?: { companyId?: string; entity?: string; type?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/workflows?' + query.toString());
}

export async function initiateWorkflow(data: { workflowDefId: string; entityId: string; initiatedBy: string }) {
  return apiFetch('/workflows', { method: 'POST', body: JSON.stringify(data) });
}

export async function createWorkflowDefinition(data: Record<string, unknown>) {
  return apiFetch('/workflows', { method: 'POST', body: JSON.stringify({ action: 'create_definition', ...data }) });
}

export async function processWorkflowStepApi(data: { instanceId: string; stepOrder: number; action: 'approve' | 'reject'; comments?: string; actionedBy: string }) {
  return apiFetch('/workflows', { method: 'PATCH', body: JSON.stringify(data) });
}

// ==================== SURVEYS ====================
export async function getSurveys(params?: { companyId?: string; status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/surveys?' + query.toString());
}

export async function createSurvey(data: Record<string, unknown>) {
  return apiFetch('/surveys', { method: 'POST', body: JSON.stringify(data) });
}

export async function submitSurveyResponse(data: { questionId: string; answer: string; employeeId: string }) {
  return apiFetch('/surveys', { method: 'POST', body: JSON.stringify({ action: 'respond', ...data }) });
}

// ==================== DEPARTMENTS ====================
export async function getDepartments(params?: { companyId?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch<{ id: string; name: string; code: string; description: string | null; isActive: boolean; companyId: string }[]>(`/departments?${query.toString()}`);
}

// ==================== BRANCHES ====================
export async function getBranches(params?: { companyId?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch<{ id: string; name: string; code: string; city: string | null; country: string | null; isActive: boolean; companyId: string }[]>(`/branches?${query.toString()}`);
}

// ==================== ONBOARDING ====================
export async function getOnboardingTasks(params?: { employeeId?: string; status?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/onboarding?' + query.toString());
}

export async function createOnboardingTask(data: Record<string, unknown>) {
  return apiFetch('/onboarding', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateOnboardingTask(id: string, data: Record<string, unknown>) {
  return apiFetch('/onboarding', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== ANALYTICS ====================
export async function getAnalytics(params?: { companyId?: string }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/analytics?' + query.toString());
}

// ==================== COMPLIANCE ====================
export async function getComplianceItems(params?: { companyId?: string; status?: string; category?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/compliance?' + query.toString());
}

export async function createComplianceItem(data: Record<string, unknown>) {
  return apiFetch('/compliance', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateComplianceItem(id: string, data: Record<string, unknown>) {
  return apiFetch('/compliance', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
}

// ==================== SHIFTS ====================
export async function getShifts(params?: { companyId?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/shifts?' + query.toString());
}

// ==================== AUDIT ====================
export async function getAuditLogs(params?: { entity?: string; action?: string; userId?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  return apiFetch('/audit?' + query.toString());
}
