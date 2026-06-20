import React from 'react';
import { Form, Input, Button } from 'antd';
import { User, Lock, ArrowRight, Shield } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth.ts';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { loading, error, handleLogin } = useAdminAuth();
  const navigate = useNavigate();

  const onFinish = (values: any) => {
    handleLogin(
      {
        email: values.email,
        password: values.password,
      },
      () => {
        // Redirect to feedback dashboard on successful login
        navigate('/feedback');
      }
    );
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--color-background-secondary)] font-sans px-4">
      {/* Symmetrical subtle background gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_var(--color-primary)_0%,_transparent_40%)] opacity-[0.03] dark:opacity-[0.05]" />
      
      {/* Main Administrative Card Container */}
      <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm rounded-xl p-8 md:p-10 transition-all duration-300">
        
        {/* Header - clean and professional */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[var(--opacity-10)] text-[var(--color-primary)] mb-4">
            <Shield size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            RESOMIX ADMIN
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] font-light">
            Administrative Control Center
          </p>
        </div>

        {/* Form */}
        <Form
          name="admin_login"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          size="large"
          className="space-y-4"
        >
          {error && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-200 text-sm flex items-start gap-2 mb-4">
              <span className="font-semibold text-red-500 dark:text-red-400">Error:</span>
              <span>{error}</span>
            </div>
          )}
          
          <Form.Item
            name="email"
            label={<span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-secondary)]">Admin Email</span>}
            rules={[
              { required: true, message: 'Please input your Admin Email!' },
              { type: 'email', message: 'Please enter a valid email address!' }
            ]}
          >
            <Input 
              prefix={<User className="text-[var(--color-text-tertiary)] mr-2" size={16} />} 
              placeholder="admin@resomix.com" 
              autoComplete="username"
              className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all duration-300"
            />
          </Form.Item>
 
          <Form.Item
            name="password"
            label={<span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-secondary)]">Password</span>}
            rules={[{ required: true, message: 'Please input your Password!' }]}
          >
            <Input.Password
              prefix={<Lock className="text-[var(--color-text-tertiary)] mr-2" size={16} />}
              placeholder="••••••••"
              autoComplete="current-password"
              className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all duration-300"
            />
          </Form.Item>

          <Form.Item className="pt-2 !mb-0">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full h-11 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] border-none text-white font-medium rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Authenticate Session</span>
              <ArrowRight size={16} />
            </Button>
          </Form.Item>
        </Form>

        {/* Footer details */}
        <div className="mt-8 text-center text-xs text-[var(--color-text-tertiary)] font-light">
          &copy; {new Date().getFullYear()} Resomix Inc. B2B Management
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
