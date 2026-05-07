// src/App.tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PublicLayout from './components/PublicLayout';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'admin' | 'user' }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace />;
  }
  return children;
}

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes with navbar and footer */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Protected admin routes with sidebar */}
      <Route path="/admin" element={
        <ProtectedRoute role="admin">
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
      </Route>

      {/* Protected user routes with sidebar */}
      <Route path="/user" element={
        <ProtectedRoute role="user">
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<UserDashboard />} />
      </Route>

      {/* Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}