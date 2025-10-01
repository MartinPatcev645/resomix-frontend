import type { ThemeConfig } from 'antd'

// Light theme configuration
export const lightTheme: ThemeConfig = {
  token: {
    // Primary colors
    colorPrimary: '#6366f1',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    
    // Border
    borderRadius: 8,
    
    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    
    // Layout
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f9fafb',
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#f3f4f6',
    
    // Text
    colorText: '#111827',
    colorTextSecondary: '#6b7280',
    colorTextTertiary: '#9ca3af',
    colorTextQuaternary: '#d1d5db',
  },
  components: {
    Table: {
      headerBg: '#f9fafb',
      headerColor: '#111827',
      rowHoverBg: '#f3f4f6',
    },
    Card: {
      headerBg: 'transparent',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: 'rgba(99, 102, 241, 0.1)',
      itemSelectedColor: '#6366f1',
    },
  },
}

// Dark theme configuration
export const darkTheme: ThemeConfig = {
  token: {
    // Primary colors (softer for dark mode)
    colorPrimary: '#818cf8',
    colorSuccess: '#34d399',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorInfo: '#60a5fa',
    
    // Border
    borderRadius: 8,
    
    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    
    // Layout
    colorBgContainer: '#1e293b',
    colorBgElevated: '#1e293b',
    colorBgLayout: '#0f172a',
    colorBorder: '#334155',
    colorBorderSecondary: '#1e293b',
    
    // Text
    colorText: '#f1f5f9',
    colorTextSecondary: '#cbd5e1',
    colorTextTertiary: '#94a3b8',
    colorTextQuaternary: '#475569',
  },
  components: {
    Table: {
      headerBg: '#334155',
      headerColor: '#f1f5f9',
      rowHoverBg: '#334155',
    },
    Card: {
      headerBg: 'transparent',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: 'rgba(129, 140, 248, 0.1)',
      itemSelectedColor: '#818cf8',
    },
  },
}
