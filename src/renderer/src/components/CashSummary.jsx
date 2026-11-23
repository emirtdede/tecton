import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency } from '../utils/formatUtils';

const CashSummary = ({ t, i18n, projNetBalance, projTotalIn, projTotalOut, reportDate, setReportDate, reportData }) => {
  return (
    <>
      {/* Main Balance Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card balance-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <h3 className="card-subtitle">{t('cash.net_balance')}</h3>
          <div style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            marginTop: '0.25rem',
            color: projNetBalance >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
            textShadow: projNetBalance >= 0 ? 'var(--success-shadow)' : 'var(--danger-shadow)'
          }}>
            {formatCurrency(projNetBalance, i18n.language)}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', background: 'var(--success-bg-light)', border: '1px solid var(--success-border)', boxShadow: 'var(--card-shadow)' }}>
            <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.total_in')}</h4>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success-text)', marginTop: '0.25rem' }}>
              {formatCurrency(projTotalIn, i18n.language)}
            </div>
          </div>
          <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', background: 'var(--danger-bg-light)', border: '1px solid var(--danger-border)', boxShadow: 'var(--card-shadow)' }}>
            <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.total_out')}</h4>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-text)', marginTop: '0.25rem' }}>
              {formatCurrency(projTotalOut, i18n.language)}
            </div>
          </div>
        </div>
      </div>

      {/* Company Monthly Summary */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="card-title">{t('cash.monthly_summary')}</h3>
          <div style={{ width: '12rem' }}>
            <CustomDatePicker
              className="form-input"
              value={reportDate}
              popperPlacement="bottom-end"
              onChange={(e) => {
                if (e.target.value) {
                  setReportDate(e.target.value);
                }
              }}
            />
          </div>
        </div>

        {reportData ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: 'var(--accent-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.wage_cost')}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{formatCurrency(reportData.summary.totalWageCost, i18n.language)}</div>
            </div>
            <div style={{ background: 'var(--success-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--success-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.monthly_in')}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success-text)' }}>{formatCurrency(reportData.summary.totalCashIn, i18n.language)}</div>
            </div>
            <div style={{ background: 'var(--danger-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--danger-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.monthly_out')}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger-text)' }}>{formatCurrency(reportData.summary.totalCashOut, i18n.language)}</div>
            </div>
            <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.net_change')}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: reportData.summary.netCashFlow >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {reportData.summary.netCashFlow > 0 ? '+' : ''}{formatCurrency(reportData.summary.netCashFlow, i18n.language)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center"><div className="loading-spinner"></div></div>
        )}
      </div>
    </>
  );
};

export default CashSummary;
