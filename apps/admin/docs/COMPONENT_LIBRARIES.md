# Component Libraries Guide

> Using Lucide React, Ant Design, and Recharts in the Admin Dashboard

---

## 📦 Installed Libraries

### 1. **Lucide React** - Icons
- **Version**: ^0.469.0
- **Purpose**: Lightweight, beautiful icons
- **Bundle Size**: Tree-shakeable (only imports used icons)
- **Website**: https://lucide.dev

### 2. **Ant Design** - UI Components
- **Version**: ^5.22.6
- **Purpose**: Enterprise-grade UI components (tables, forms, modals, etc.)
- **Bundle Size**: ~600KB (optimized with tree-shaking)
- **Website**: https://ant.design

### 3. **Recharts** - Data Visualization
- **Version**: ^2.15.0
- **Purpose**: Charts and graphs for analytics
- **Bundle Size**: ~200KB
- **Website**: https://recharts.org

---

## 🎨 Theme Integration

All three libraries are configured to work with our custom light/dark theme!

### Ant Design Theme

The theme automatically switches based on `useTheme()`:

```tsx
// In App.tsx - already configured
<ConfigProvider theme={theme === 'light' ? lightTheme : darkTheme}>
  <AntApp>
    {/* Your app */}
  </AntApp>
</ConfigProvider>
```

Theme colors match our CSS variables:
- **Primary**: Indigo (#6366f1 / #818cf8)
- **Success**: Green (#10b981 / #34d399)
- **Warning**: Amber (#f59e0b / #fbbf24)
- **Error**: Red (#ef4444 / #f87171)

---

## 🔷 Lucide React - Icons

### Basic Usage

```tsx
import { Home, User, Settings, Bell } from 'lucide-react'

function MyComponent() {
  return (
    <div>
      <Home size={24} />
      <User size={20} className="text-primary" />
      <Settings size={18} color="var(--color-primary)" />
      <Bell size={24} strokeWidth={1.5} />
    </div>
  )
}
```

### Icon Props

```tsx
<IconName
  size={24}              // Size in pixels
  color="currentColor"   // Color (use CSS variables)
  strokeWidth={2}        // Line thickness (1-3)
  className="..."        // Tailwind classes
  absoluteStrokeWidth    // Consistent stroke at any size
/>
```

### Commonly Used Icons

| Icon | Import | Use Case |
|------|--------|----------|
| `Home` | `import { Home } from 'lucide-react'` | Dashboard home |
| `User` | `import { User } from 'lucide-react'` | User profile |
| `Settings` | `import { Settings } from 'lucide-react'` | Settings |
| `Bell` | `import { Bell } from 'lucide-react'` | Notifications |
| `Search` | `import { Search } from 'lucide-react'` | Search bars |
| `Plus` | `import { Plus } from 'lucide-react'` | Add/Create |
| `Edit` | `import { Edit } from 'lucide-react'` | Edit actions |
| `Trash2` | `import { Trash2 } from 'lucide-react'` | Delete actions |
| `Download` | `import { Download } from 'lucide-react'` | Download |
| `Upload` | `import { Upload } from 'lucide-react'` | Upload |
| `Filter` | `import { Filter } from 'lucide-react'` | Filtering |
| `Calendar` | `import { Calendar } from 'lucide-react'` | Dates |
| `Clock` | `import { Clock } from 'lucide-react'` | Time |
| `CheckCircle` | `import { CheckCircle } from 'lucide-react'` | Success |
| `XCircle` | `import { XCircle } from 'lucide-react'` | Error |
| `AlertCircle` | `import { AlertCircle } from 'lucide-react'` | Warning |

**Browse all icons**: https://lucide.dev/icons

---

## 🎛️ Ant Design - Components

### 1. Tables (Most Important for Admin)

```tsx
import { Table, Tag, Space, Button } from 'antd'
import { Edit, Trash2 } from 'lucide-react'

const columns = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  {
    title: 'Email',
    dataIndex: 'email',
    key: 'email',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => (
      <Tag color={status === 'active' ? 'green' : 'default'}>
        {status}
      </Tag>
    ),
  },
  {
    title: 'Actions',
    key: 'actions',
    render: (_, record) => (
      <Space>
        <Button type="link" icon={<Edit size={16} />}>
          Edit
        </Button>
        <Button type="link" danger icon={<Trash2 size={16} />}>
          Delete
        </Button>
      </Space>
    ),
  },
]

function MyTable() {
  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      pagination={{ pageSize: 10 }}
      loading={loading}
    />
  )
}
```

### 2. Cards

```tsx
import { Card, Statistic } from 'antd'
import { TrendingUp } from 'lucide-react'

function StatsCard() {
  return (
    <Card>
      <Statistic
        title="Total Users"
        value={1128}
        prefix={<TrendingUp size={20} />}
        valueStyle={{ color: 'var(--color-success)' }}
      />
    </Card>
  )
}
```

### 3. Forms

```tsx
import { Form, Input, Button, Select } from 'antd'

function MyForm() {
  const [form] = Form.useForm()
  
  const onFinish = (values) => {
    console.log('Form values:', values)
  }
  
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
    >
      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true }]}
      >
        <Input />
      </Form.Item>
      
      <Form.Item
        name="email"
        label="Email"
        rules={[{ required: true, type: 'email' }]}
      >
        <Input />
      </Form.Item>
      
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  )
}
```

### 4. Modals

```tsx
import { Modal, Button } from 'antd'
import { useState } from 'react'

function MyModal() {
  const [open, setOpen] = useState(false)
  
  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        Open Modal
      </Button>
      
      <Modal
        title="Modal Title"
        open={open}
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <p>Modal content goes here</p>
      </Modal>
    </>
  )
}
```

### 5. Notifications & Messages

```tsx
import { message, notification } from 'antd'
import { CheckCircle } from 'lucide-react'

// Simple message
message.success('Action completed successfully!')
message.error('Something went wrong')
message.warning('Please check your input')

// Rich notification
notification.open({
  message: 'Success',
  description: 'Your changes have been saved.',
  icon: <CheckCircle style={{ color: 'var(--color-success)' }} />,
  placement: 'topRight',
})
```

### 6. Drawers (Side Panels)

```tsx
import { Drawer, Button } from 'antd'
import { useState } from 'react'

function MyDrawer() {
  const [open, setOpen] = useState(false)
  
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Drawer</Button>
      
      <Drawer
        title="Drawer Title"
        placement="right"
        onClose={() => setOpen(false)}
        open={open}
        width={400}
      >
        <p>Drawer content</p>
      </Drawer>
    </>
  )
}
```

### 7. Pagination

```tsx
import { Pagination } from 'antd'

function MyPagination() {
  return (
    <Pagination
      current={1}
      total={100}
      pageSize={10}
      onChange={(page) => console.log(page)}
      showSizeChanger
      showTotal={(total) => `Total ${total} items`}
    />
  )
}
```

### 8. Tabs

```tsx
import { Tabs } from 'antd'

const items = [
  { key: '1', label: 'Tab 1', children: 'Content 1' },
  { key: '2', label: 'Tab 2', children: 'Content 2' },
]

function MyTabs() {
  return <Tabs items={items} />
}
```

### 9. Select & Filters

```tsx
import { Select, DatePicker, Space } from 'antd'

function Filters() {
  return (
    <Space>
      <Select
        style={{ width: 200 }}
        placeholder="Select status"
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
      />
      
      <DatePicker.RangePicker />
    </Space>
  )
}
```

---

## 📊 Recharts - Charts

### 1. Line Chart

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'Jan', users: 400, revenue: 2400 },
  { name: 'Feb', users: 300, revenue: 1398 },
  { name: 'Mar', users: 200, revenue: 9800 },
]

function MyLineChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="users" stroke="#6366f1" />
        <Line type="monotone" dataKey="revenue" stroke="#ec4899" />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

### 2. Bar Chart

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function MyBarChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="users" fill="#6366f1" />
        <Bar dataKey="revenue" fill="#ec4899" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

### 3. Pie Chart

```tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'Active', value: 400 },
  { name: 'Pending', value: 300 },
  { name: 'Inactive', value: 100 },
]

const COLORS = ['#10b981', '#f59e0b', '#ef4444']

function MyPieChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

### 4. Area Chart

```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function MyAreaChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Area type="monotone" dataKey="users" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

---

## 🎯 Best Practices

### DO ✅

1. **Import only what you need** (tree-shaking)
   ```tsx
   import { Button, Table } from 'antd'  // Good
   ```

2. **Use Lucide icons for custom buttons**
   ```tsx
   <Button icon={<Plus size={16} />}>Add New</Button>
   ```

3. **Wrap charts in Cards**
   ```tsx
   <Card title="User Growth">
     <ResponsiveContainer>
       <LineChart>...</LineChart>
     </ResponsiveContainer>
   </Card>
   ```

4. **Use Ant Design's built-in loading states**
   ```tsx
   <Table loading={isLoading} />
   <Button loading={isSubmitting} />
   ```

5. **Combine libraries**
   ```tsx
   // Ant Design Card + Recharts Chart + Lucide Icon
   <Card 
     title={<Space><BarChart3 size={20} /> Analytics</Space>}
   >
     <LineChart>...</LineChart>
   </Card>
   ```

### DON'T ❌

1. Don't import entire libraries
   ```tsx
   import * from 'antd'  // Bad - huge bundle
   ```

2. Don't mix UI libraries unnecessarily
   - We chose Ant Design, stick with it for consistency

3. Don't override Ant Design theme colors with inline styles
   - Use the theme configuration instead

4. Don't forget responsive containers for charts
   ```tsx
   <ResponsiveContainer width="100%" height={300}>
     {/* Always wrap charts */}
   </ResponsiveContainer>
   ```

---

## 📚 Quick Reference

### Installation Command
```bash
pnpm add lucide-react antd recharts
```

### Common Imports
```tsx
// Icons
import { Home, User, Settings } from 'lucide-react'

// Tables & Data
import { Table, Tag, Space, Pagination } from 'antd'

// Forms
import { Form, Input, Button, Select, DatePicker } from 'antd'

// Feedback
import { message, notification, Modal } from 'antd'

// Charts
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
```

---

## 🔗 Documentation Links

- **Lucide React**: https://lucide.dev/guide/packages/lucide-react
- **Ant Design**: https://ant.design/components/overview
- **Recharts**: https://recharts.org/en-US/api

---

**Last Updated**: October 01, 2025 