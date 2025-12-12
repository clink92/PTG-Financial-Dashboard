'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Pie, Bar } from 'react-chartjs-2'
import { financialData, availableMonths, getMonthData, getTrendData, MonthlyData } from '@/lib/data'
import { generateInsights, generateAISummary, AIInsight } from '@/lib/insights'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = useState('nov-2025')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const monthData = getMonthData(selectedMonth)
  const trendData = getTrendData()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (monthData) {
      setLoadingInsights(true)
      // Simulate AI analysis delay
      setTimeout(() => {
        setInsights(generateInsights(monthData))
        setAiSummary(generateAISummary(monthData))
        setLoadingInsights(false)
      }, 800)
    }
  }, [selectedMonth])

  if (status === 'loading' || !monthData) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    )
  }

  // Chart data
  const noiChartData = {
    labels: trendData.map(d => d.label.split(' ')[0]),
    datasets: [
      {
        label: 'Actual NOI',
        data: trendData.map(d => d.noi.actual),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Budget',
        data: trendData.map(d => d.noi.budget),
        borderColor: '#9ca3af',
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
      }
    ]
  }

  const expenseData = {
    labels: ['Payroll', 'Utilities', 'R&M', 'Legal', 'Admin', 'Taxes', 'Debt'],
    datasets: [{
      data: [
        monthData.expenses.payroll,
        monthData.expenses.utilities,
        monthData.expenses.repairsMaint,
        monthData.expenses.legal,
        monthData.expenses.adminGeneral,
        monthData.expenses.propertyTaxes,
        monthData.expenses.debtService
      ],
      backgroundColor: [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'
      ],
    }]
  }

  const varianceData = {
    labels: ['Utilities', 'R&M', 'Legal', 'Admin'],
    datasets: [
      {
        label: 'Actual',
        data: [
          monthData.expenses.utilities,
          monthData.expenses.repairsMaint,
          monthData.expenses.legal,
          monthData.expenses.adminGeneral
        ],
        backgroundColor: '#3b82f6',
      },
      {
        label: 'Budget',
        data: [
          monthData.budgets.utilities,
          monthData.budgets.repairsMaint,
          monthData.budgets.legal,
          monthData.budgets.adminGeneral
        ],
        backgroundColor: '#9ca3af',
      }
    ]
  }

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
  }

  return (
    <div className="page">
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 20,
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
            Park Terrace Gardens
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Financial Dashboard • Real-time Analysis & AI Insights
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="security-badge">
            <i className="fas fa-shield-alt"></i>
            Secure
          </div>
          
          <div className="month-selector">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="user-menu">
            <button 
              className="user-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-avatar">{getInitials(session?.user?.name || '')}</div>
              <span>{session?.user?.name}</span>
              <i className="fas fa-chevron-down" style={{ fontSize: 10, color: 'var(--text-muted)' }}></i>
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-item" onClick={() => { setShowPasswordModal(true); setShowUserMenu(false); }}>
                  <i className="fas fa-key"></i>
                  Change Password
                </div>
                <div className="user-dropdown-item" onClick={() => { setShowSecurityModal(true); setShowUserMenu(false); }}>
                  <i className="fas fa-shield-alt"></i>
                  Security Settings
                </div>
                <div className="user-dropdown-divider"></div>
                <div className="user-dropdown-item" onClick={() => signOut({ callbackUrl: '/login' })}>
                  <i className="fas fa-sign-out-alt"></i>
                  Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button 
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-chart-pie" style={{ marginRight: 6 }}></i>
          Overview
        </button>
        <button 
          className={`tab-item ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          <i className="fas fa-brain" style={{ marginRight: 6 }}></i>
          AI Insights
        </button>
        <button 
          className={`tab-item ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          <i className="fas fa-chart-line" style={{ marginRight: 6 }}></i>
          Trends
        </button>
        <button 
          className={`tab-item ${activeTab === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          <i className="fas fa-clipboard-check" style={{ marginRight: 6 }}></i>
          QA Report
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Grid */}
          <div className="grid">
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-dollar-sign"></i>
                  Net Operating Income
                </div>
                <div className="card-tag success">MTD</div>
              </div>
              <div className="metric-main">{formatCurrency(monthData.noi.actual)}</div>
              <div className="metric-sub">
                Budget <span className={monthData.noi.budget >= 0 ? 'positive' : 'negative'}>
                  {formatCurrency(monthData.noi.budget)}
                </span>
                &nbsp; • &nbsp;
                Variance <span className={monthData.noi.variance >= 0 ? 'positive' : 'negative'}>
                  {monthData.noi.variance >= 0 ? '+' : ''}{formatCurrency(monthData.noi.variance)}
                </span>
              </div>
              <div className={`metric-badge ${monthData.noi.variance >= 0 ? '' : 'negative'}`}>
                <i className={`fas fa-${monthData.noi.variance >= 0 ? 'arrow-up' : 'arrow-down'}`}></i>
                {monthData.noi.variance >= 0 ? 'Above Budget' : 'Below Budget'}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-piggy-bank"></i>
                  Total Cash Position
                </div>
                <div className="card-tag">Balances</div>
              </div>
              <div className="metric-main">{formatCurrency(monthData.cash.total)}</div>
              <div className="metric-sub">
                Operating <span>{formatCurrency(monthData.cash.operating)}</span>
                &nbsp; • &nbsp;
                Reserves <span>{formatCurrency(monthData.cash.reserves)}</span>
              </div>
              <div className="metric-badge info">
                <i className="fas fa-check-circle"></i>
                High Liquidity
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-file-invoice-dollar"></i>
                  Arrears
                </div>
                <div className="card-tag warning">Receivables</div>
              </div>
              <div className="metric-main">{formatCurrency(monthData.arrears.amount)}</div>
              <div className="metric-sub">
                {monthData.arrears.note}
              </div>
              <div className={`metric-badge ${monthData.arrears.trend === 'down' ? '' : 'warning'}`}>
                <i className={`fas fa-arrow-${monthData.arrears.trend}`}></i>
                Trending {monthData.arrears.trend === 'down' ? 'Down' : monthData.arrears.trend === 'up' ? 'Up' : 'Stable'}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-tools"></i>
                  Legal & R&M
                </div>
                <div className="card-tag danger">Key Drivers</div>
              </div>
              <div className="metric-main">{formatCurrency(monthData.expenses.legal + monthData.expenses.repairsMaint)}</div>
              <div className="metric-sub">
                Legal <span>{formatCurrency(monthData.expenses.legal)}</span>
                &nbsp; • &nbsp;
                R&M <span>{formatCurrency(monthData.expenses.repairsMaint)}</span>
              </div>
              <div className={`metric-badge ${monthData.expenses.legal > monthData.budgets.legal ? 'negative' : ''}`}>
                <i className="fas fa-exclamation-triangle"></i>
                Legal {monthData.expenses.legal > monthData.budgets.legal ? 'Over Budget' : 'Within Budget'}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="layout-2col">
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-chart-line"></i>
                  NOI Trend
                </div>
                <div className="card-tag">Last 6 Months</div>
              </div>
              <div className="card-body" style={{ height: 280 }}>
                <Line 
                  data={noiChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                      y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } }
                    }
                  }}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="fas fa-chart-pie"></i>
                  Expense Breakdown
                </div>
                <div className="card-tag">{monthData.month}</div>
              </div>
              <div className="card-body" style={{ height: 280 }}>
                <Pie 
                  data={expenseData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">
                <i className="fas fa-balance-scale"></i>
                Actual vs Budget by Category
              </div>
              <div className="card-tag">{monthData.month}</div>
            </div>
            <div className="card-body" style={{ height: 250 }}>
              <Bar 
                data={varianceData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                  scales: {
                    y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } }
                  }
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <i className="fas fa-sticky-note"></i>
                Notes for {monthData.month}
              </div>
              <div className="card-tag">Context</div>
            </div>
            <div className="card-body">
              <ul className="notes">
                {monthData.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'insights' && (
        <div className="layout-2col" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card ai-panel">
            <div className="ai-header">
              <div className="ai-icon">
                <i className="fas fa-robot"></i>
              </div>
              <div>
                <div className="ai-title">AI Financial Analysis</div>
                <div className="ai-subtitle">Powered by machine learning • {monthData.month} {monthData.year}</div>
              </div>
            </div>

            {loadingInsights ? (
              <div className="ai-loading">
                <div className="spinner"></div>
                Analyzing financial data...
              </div>
            ) : (
              <>
                <div style={{ 
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 20
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>
                    <i className="fas fa-lightbulb" style={{ marginRight: 8 }}></i>
                    Executive Summary
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-main)', fontSize: 14 }}>
                    {aiSummary}
                  </p>
                </div>

                <h4 style={{ marginBottom: 16, color: 'var(--text-main)' }}>
                  <i className="fas fa-list-check" style={{ marginRight: 8, color: 'var(--accent)' }}></i>
                  Key Insights ({insights.length})
                </h4>

                {insights.map((insight) => (
                  <div key={insight.id} className="ai-insight" style={{
                    borderLeftColor: 
                      insight.type === 'positive' ? 'var(--success)' :
                      insight.type === 'negative' ? 'var(--danger)' :
                      insight.type === 'warning' ? 'var(--warning)' : 'var(--accent)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div className="ai-insight-title">
                        <i className={`fas fa-${
                          insight.type === 'positive' ? 'check-circle' :
                          insight.type === 'negative' ? 'exclamation-circle' :
                          insight.type === 'warning' ? 'exclamation-triangle' : 'info-circle'
                        }`} style={{ 
                          marginRight: 8,
                          color: 
                            insight.type === 'positive' ? 'var(--success)' :
                            insight.type === 'negative' ? 'var(--danger)' :
                            insight.type === 'warning' ? 'var(--warning)' : 'var(--accent)'
                        }}></i>
                        {insight.title}
                      </div>
                      {insight.metric && (
                        <span style={{
                          background: 'var(--bg)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          color: 
                            insight.type === 'positive' ? 'var(--success)' :
                            insight.type === 'negative' ? 'var(--danger)' : 'var(--text-main)'
                        }}>
                          {insight.metric}
                        </span>
                      )}
                    </div>
                    <div className="ai-insight-text">{insight.description}</div>
                    {insight.recommendation && (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        background: 'var(--accent-soft)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: 'var(--accent)'
                      }}>
                        <strong>Recommendation:</strong> {insight.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <i className="fas fa-chart-area"></i>
                6-Month NOI Performance
              </div>
            </div>
            <div className="card-body" style={{ height: 350 }}>
              <Line 
                data={noiChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top' } },
                  scales: {
                    y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } }
                  }
                }}
              />
            </div>
          </div>

          <div className="layout-3col">
            {trendData.slice(-3).map((data) => (
              <div className="card" key={data.label}>
                <div className="card-header">
                  <div className="card-title">{data.label}</div>
                  <div className={`card-tag ${data.noi.variance >= 0 ? 'success' : 'danger'}`}>
                    {data.noi.variance >= 0 ? '+' : ''}{formatCurrency(data.noi.variance)}
                  </div>
                </div>
                <div className="stat-row">
                  <span className="stat-label">NOI</span>
                  <span className="stat-value">{formatCurrency(data.noi.actual)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Cash</span>
                  <span className="stat-value">{formatCurrency(data.cash.total)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Arrears</span>
                  <span className={`stat-value ${data.arrears.trend === 'down' ? 'positive' : 'negative'}`}>
                    {formatCurrency(data.arrears.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QA Tab */}
      {activeTab === 'qa' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <i className="fas fa-clipboard-check"></i>
                Data Quality Checks
              </div>
              <div className="card-tag success">All Passed</div>
            </div>
            <div className="card-body">
              <div className="alert-item success">
                <i className="fas fa-check-circle"></i>
                <div className="alert-content">
                  <div className="alert-title">Revenue Reconciliation</div>
                  <div className="alert-desc">All revenue accounts balance with bank statements</div>
                </div>
              </div>
              <div className="alert-item success">
                <i className="fas fa-check-circle"></i>
                <div className="alert-content">
                  <div className="alert-title">Expense Classification</div>
                  <div className="alert-desc">All expenses properly categorized per chart of accounts</div>
                </div>
              </div>
              <div className="alert-item success">
                <i className="fas fa-check-circle"></i>
                <div className="alert-content">
                  <div className="alert-title">Budget Comparison</div>
                  <div className="alert-desc">Variance analysis completed for all line items</div>
                </div>
              </div>
              <div className="alert-item warning">
                <i className="fas fa-exclamation-triangle"></i>
                <div className="alert-content">
                  <div className="alert-title">Missing Bill Alert</div>
                  <div className="alert-desc">Water/sewer invoice not posted - verify timing</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <i className="fas fa-exclamation-triangle"></i>
                Variance Alerts
              </div>
              <div className="card-tag warning">3 Items</div>
            </div>
            <div className="card-body">
              <div className="alert-item danger">
                <i className="fas fa-gavel"></i>
                <div className="alert-content">
                  <div className="alert-title">Legal Expenses Over Budget</div>
                  <div className="alert-desc">
                    ${(monthData.expenses.legal - monthData.budgets.legal).toLocaleString()} over budget 
                    ({Math.round((monthData.expenses.legal / monthData.budgets.legal - 1) * 100)}% variance)
                  </div>
                </div>
              </div>
              <div className="alert-item info">
                <i className="fas fa-bolt"></i>
                <div className="alert-content">
                  <div className="alert-title">Utilities Under Budget</div>
                  <div className="alert-desc">
                    ${Math.abs(monthData.expenses.utilities - monthData.budgets.utilities).toLocaleString()} favorable variance - verify all bills posted
                  </div>
                </div>
              </div>
              <div className="alert-item info">
                <i className="fas fa-wrench"></i>
                <div className="alert-content">
                  <div className="alert-title">R&M Under Budget</div>
                  <div className="alert-desc">
                    ${Math.abs(monthData.expenses.repairsMaint - monthData.budgets.repairsMaint).toLocaleString()} favorable - ensure no deferred maintenance
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div className="card-title">
                <i className="fas fa-history"></i>
                Audit Trail
              </div>
              <div className="card-tag">Recent Activity</div>
            </div>
            <div className="card-body">
              <div className="stat-row">
                <span className="stat-label">
                  <i className="fas fa-file-import" style={{ marginRight: 8 }}></i>
                  Financial data imported
                </span>
                <span className="stat-value">Dec 5, 2025 2:30 PM</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">
                  <i className="fas fa-calculator" style={{ marginRight: 8 }}></i>
                  Budget reconciliation completed
                </span>
                <span className="stat-value">Dec 5, 2025 3:15 PM</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">
                  <i className="fas fa-robot" style={{ marginRight: 8 }}></i>
                  AI analysis generated
                </span>
                <span className="stat-value">Dec 5, 2025 3:20 PM</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">
                  <i className="fas fa-user-check" style={{ marginRight: 8 }}></i>
                  Report reviewed by {session?.user?.name}
                </span>
                <span className="stat-value">Just now</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div>
          <i className="fas fa-lock" style={{ marginRight: 6 }}></i>
          Data secured with 256-bit encryption • Last sync: {new Date().toLocaleString()}
        </div>
        <div className="footer-links">
          <a onClick={() => setShowSecurityModal(true)}>Security</a>
          <a>Help</a>
          <a>Support</a>
        </div>
      </footer>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Change Password</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" placeholder="Enter current password" />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" placeholder="Enter new password" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" placeholder="Confirm new password" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                <i className="fas fa-info-circle" style={{ marginRight: 6 }}></i>
                Password must be at least 8 characters with uppercase, lowercase, and numbers
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ width: 'auto' }}>Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showSecurityModal && (
        <div className="modal-overlay" onClick={() => setShowSecurityModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Security Settings</h3>
              <button className="modal-close" onClick={() => setShowSecurityModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Two-Factor Authentication</h4>
                  <p>Add an extra layer of security to your account</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Session Timeout</h4>
                  <p>Automatically log out after 30 minutes of inactivity</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Login Notifications</h4>
                  <p>Get notified when someone logs into your account</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="security-item">
                <div className="security-item-info">
                  <h4>Data Export Approval</h4>
                  <p>Require approval before exporting sensitive data</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSecurityModal(false)}>Close</button>
              <button className="btn btn-primary" style={{ width: 'auto' }}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
