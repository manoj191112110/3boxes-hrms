'use client'

import { useState } from 'react'
import { FiSettings, FiClock, FiBell, FiDollarSign, FiSave, FiCheck, FiGlobe } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useCompanyData } from '@/components/company/useCompanyData'

interface SettingSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  gradient: string
  settings: SettingItem[]
}

interface SettingItem {
  id: string
  label: string
  description: string
  type: 'toggle' | 'input' | 'select' | 'time' | 'readonly'
  value: string | boolean
  options?: { label: string; value: string }[]
  placeholder?: string
}

export default function SettingsPage() {
  const { companies } = useCompanyData()
  const company = companies[0]
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<Record<string, string | boolean>>({
    // Working Hours
    workStartTime: '09:00',
    workEndTime: '18:00',
    workDaysPerWeek: '5',
    enableFlexibleHours: false,
    enableWorkFromHome: true,
    // Fiscal Year Settings
    fiscalYearStart: 'April',
    fiscalYearEnd: 'March',
    payrollCycle: 'monthly',
    taxCalculationMethod: 'old',
    enableTDS: true,
    // Notification Preferences
    notifyLeaveRequest: true,
    notifyAttendanceAlert: true,
    notifyPolicyUpdate: true,
    notifyHolidayReminder: true,
    notifyPayrollProcessed: true,
    notifyWorkAnniversary: true,
    emailNotifications: true,
    pushNotifications: true,
    slackNotifications: false,
  })

  const updateSetting = (id: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Simulate saving - in real app this would call an API
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Settings saved successfully')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const sections: SettingSection[] = [
    {
      id: 'company-info',
      title: 'Company Information',
      description: 'Auto-populated from company setup — managed in Companies section',
      icon: <FiGlobe className="w-5 h-5" />,
      gradient: 'from-green-500 to-emerald-600',
      settings: [
        { id: 'companyName', label: 'Company Name', description: 'Legal name of the organization', type: 'readonly', value: company?.name || '—' },
        { id: 'companyCode', label: 'Company Code', description: 'Short code used as identifier', type: 'readonly', value: company?.code || '—' },
        { id: 'companyEmail', label: 'Official Email', description: 'Primary company email address', type: 'readonly', value: company?.email || '—' },
        { id: 'companyPhone', label: 'Phone Number', description: 'Primary contact number', type: 'readonly', value: company?.phone || '—' },
        { id: 'companyWebsite', label: 'Website', description: 'Company website URL', type: 'readonly', value: company?.website || '—' },
      ],
    },
    {
      id: 'working-hours',
      title: 'Working Hours',
      description: 'Configure standard work hours and flexible policies',
      icon: <FiClock className="w-5 h-5" />,
      gradient: 'from-amber-500 to-orange-600',
      settings: [
        { id: 'workStartTime', label: 'Work Start Time', description: 'Standard office start time', type: 'time', value: settings.workStartTime as string },
        { id: 'workEndTime', label: 'Work End Time', description: 'Standard office end time', type: 'time', value: settings.workEndTime as string },
        { id: 'workDaysPerWeek', label: 'Working Days/Week', description: 'Number of working days in a week', type: 'select', value: settings.workDaysPerWeek as string, options: [{ label: '5 Days (Mon-Fri)', value: '5' }, { label: '5.5 Days (Mon-Sat half)', value: '5.5' }, { label: '6 Days (Mon-Sat)', value: '6' }] },
        { id: 'enableFlexibleHours', label: 'Enable Flexible Hours', description: 'Allow employees to choose their work hours within limits', type: 'toggle', value: settings.enableFlexibleHours as boolean },
        { id: 'enableWorkFromHome', label: 'Enable Work From Home', description: 'Allow employees to work from home', type: 'toggle', value: settings.enableWorkFromHome as boolean },
      ],
    },
    {
      id: 'fiscal-year',
      title: 'Fiscal Year Settings',
      description: 'Financial year, payroll cycle, and tax configuration',
      icon: <FiDollarSign className="w-5 h-5" />,
      gradient: 'from-cyan-500 to-green-600',
      settings: [
        { id: 'fiscalYearStart', label: 'Fiscal Year Start', description: 'Starting month of the financial year', type: 'select', value: settings.fiscalYearStart as string, options: [{ label: 'January', value: 'January' }, { label: 'April', value: 'April' }, { label: 'July', value: 'July' }, { label: 'October', value: 'October' }] },
        { id: 'fiscalYearEnd', label: 'Fiscal Year End', description: 'Ending month of the financial year', type: 'select', value: settings.fiscalYearEnd as string, options: [{ label: 'December', value: 'December' }, { label: 'March', value: 'March' }, { label: 'June', value: 'June' }, { label: 'September', value: 'September' }] },
        { id: 'payrollCycle', label: 'Payroll Cycle', description: 'How often payroll is processed', type: 'select', value: settings.payrollCycle as string, options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Bi-Monthly', value: 'bi-monthly' }, { label: 'Weekly', value: 'weekly' }] },
        { id: 'taxCalculationMethod', label: 'Tax Calculation Method', description: 'Income tax calculation regime', type: 'select', value: settings.taxCalculationMethod as string, options: [{ label: 'Old Regime', value: 'old' }, { label: 'New Regime', value: 'new' }] },
        { id: 'enableTDS', label: 'Enable TDS Deduction', description: 'Automatically deduct TDS from salary', type: 'toggle', value: settings.enableTDS as boolean },
      ],
    },
    {
      id: 'notifications',
      title: 'Notification Preferences',
      description: 'Choose which events trigger notifications and channels',
      icon: <FiBell className="w-5 h-5" />,
      gradient: 'from-rose-500 to-pink-600',
      settings: [
        { id: 'notifyLeaveRequest', label: 'Leave Requests', description: 'Notify on new leave requests', type: 'toggle', value: settings.notifyLeaveRequest as boolean },
        { id: 'notifyAttendanceAlert', label: 'Attendance Alerts', description: 'Alert on late arrivals and absences', type: 'toggle', value: settings.notifyAttendanceAlert as boolean },
        { id: 'notifyPolicyUpdate', label: 'Policy Updates', description: 'Notify when policies are updated', type: 'toggle', value: settings.notifyPolicyUpdate as boolean },
        { id: 'notifyHolidayReminder', label: 'Holiday Reminders', description: 'Remind about upcoming holidays', type: 'toggle', value: settings.notifyHolidayReminder as boolean },
        { id: 'notifyPayrollProcessed', label: 'Payroll Processed', description: 'Notify when payroll is processed', type: 'toggle', value: settings.notifyPayrollProcessed as boolean },
        { id: 'notifyWorkAnniversary', label: 'Work Anniversaries', description: 'Celebrate work anniversaries', type: 'toggle', value: settings.notifyWorkAnniversary as boolean },
        { id: 'emailNotifications', label: 'Email Notifications', description: 'Send notifications via email', type: 'toggle', value: settings.emailNotifications as boolean },
        { id: 'pushNotifications', label: 'Push Notifications', description: 'Send browser push notifications', type: 'toggle', value: settings.pushNotifications as boolean },
        { id: 'slackNotifications', label: 'Slack Notifications', description: 'Send notifications to Slack', type: 'toggle', value: settings.slackNotifications as boolean },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
            <FiSettings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Company Settings</h1>
            <p className="text-sm text-thb-text-secondary">Configure company-wide preferences and policies</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors disabled:opacity-50">
          {saving ? <><FiCheck className="w-4 h-4 animate-spin" /> Saving...</> : <><FiSave className="w-4 h-4" /> Save All Settings</>}
        </button>
      </div>

      {/* Settings Sections */}
      {sections.map(section => (
        <div key={section.id} className="thb-card">
          <div className="p-5 border-b border-thb-border">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${section.gradient} flex items-center justify-center text-white shadow-sm`}>
                {section.icon}
              </div>
              <div>
                <h2 className="text-base font-semibold text-thb-text-primary">{section.title}</h2>
                <p className="text-xs text-thb-text-secondary">{section.description}</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {section.settings.map(item => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-thb-border/30 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-thb-text-primary">{item.label}</p>
                  <p className="text-xs text-thb-text-muted mt-0.5">{item.description}</p>
                </div>
                <div className="flex-shrink-0 sm:w-56">
                  {item.type === 'readonly' && (
                    <div className="w-full px-3 py-2 rounded-lg border border-thb-border bg-slate-50 text-sm text-thb-text-secondary">
                      {item.value as string || '—'}
                    </div>
                  )}
                  {item.type === 'toggle' && (
                    <button
                      onClick={() => updateSetting(item.id, !settings[item.id])}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${settings[item.id] ? 'bg-teal-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${settings[item.id] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  )}
                  {item.type === 'input' && (
                    <input
                      type="text"
                      value={settings[item.id] as string}
                      onChange={e => updateSetting(item.id, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    />
                  )}
                  {item.type === 'select' && (
                    <select
                      value={settings[item.id] as string}
                      onChange={e => updateSetting(item.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    >
                      {item.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                  {item.type === 'time' && (
                    <input
                      type="time"
                      value={settings[item.id] as string}
                      onChange={e => updateSetting(item.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save Footer */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-4">
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors disabled:opacity-50">
          {saving ? <><FiCheck className="w-4 h-4 animate-spin" /> Saving...</> : <><FiSave className="w-4 h-4" /> Save All Settings</>}
        </button>
      </div>
    </div>
  )
}
