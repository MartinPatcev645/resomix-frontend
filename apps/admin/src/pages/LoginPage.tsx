import React from 'react';
import { Form, Input, Button } from 'antd';
import { User, Lock, ArrowRight } from 'lucide-react';
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 font-sans">
      {/* Dynamic Glowing Mesh Background */}
      <div className="absolute top-0 left-0 w-full h-full z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950" />
      
      {/* Animated Floating Glow Orbs */}
      <div className="absolute top-1/4 left-1/3 w-[35rem] h-[35rem] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse z-0" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-1/3 w-[30rem] h-[30rem] bg-pink-500/10 rounded-full blur-[100px] animate-pulse z-0" style={{ animationDuration: '12s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25rem] h-[25rem] bg-violet-600/10 rounded-full blur-[120px] z-0" />

      {/* Main Glassmorphic Card Container */}
      <div className="relative w-full max-w-md mx-4 p-[1px] rounded-2xl bg-gradient-to-b from-indigo-500/30 via-transparent to-pink-500/30 shadow-2xl z-10 hover:shadow-indigo-500/5 transition-all duration-700">
        <div className="w-full bg-slate-900/60 backdrop-blur-2xl rounded-2xl p-8 md:p-10 border border-slate-800/80">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 shadow-lg shadow-indigo-500/20 mb-4 animate-bounce" style={{ animationDuration: '3s' }}>
              <span className="text-white text-2xl font-bold tracking-wider">R</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
              RESOMIX
            </h1>
            <p className="mt-2 text-sm text-slate-400 font-medium">
              Administrative Control Center
            </p>
          </div>

          {/* Form */}
          <Form
            name="admin_login"
            layout="vertical"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            requiredMark={false}
            size="large"
            className="space-y-4"
          >
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm flex items-start gap-2 shadow-[0_0_15px_rgba(239,68,68,0.08)] mb-4">
                <span className="font-semibold text-red-400">Error:</span>
                <span>{error}</span>
              </div>
            )}
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your Admin Email!' },
                { type: 'email', message: 'Please enter a valid email address!' }
              ]}
            >
              <Input 
                prefix={<User className="text-indigo-400/80 mr-2" size={18} />} 
                placeholder="Admin Email" 
                className="bg-slate-950/50 border-slate-800 text-white rounded-xl placeholder-slate-500 hover:border-indigo-500/50 focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-300"
                style={{
                  background: 'rgba(2, 6, 23, 0.5)',
                  borderColor: 'rgba(51, 65, 85, 0.5)',
                  color: '#fff',
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your Password!' }]}
            >
              <Input.Password
                prefix={<Lock className="text-indigo-400/80 mr-2" size={18} />}
                placeholder="Password"
                className="bg-slate-950/50 border-slate-800 text-white rounded-xl placeholder-slate-500 hover:border-indigo-500/50 focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-300"
                style={{
                  background: 'rgba(2, 6, 23, 0.5)',
                  borderColor: 'rgba(51, 65, 85, 0.5)',
                  color: '#fff',
                }}
              />
            </Form.Item>

            <Form.Item className="pt-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="w-full h-12 bg-gradient-to-r from-indigo-500 to-pink-500 border-none text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-pink-600 hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Authenticate Session</span>
                <ArrowRight size={18} />
              </Button>
            </Form.Item>
          </Form>

          {/* Footer details */}
          <div className="mt-8 text-center text-xs text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} Resomix Inc. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
