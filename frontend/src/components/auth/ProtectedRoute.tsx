import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth';
import { useRole, type AppRole } from '../../contexts/RoleContext';
import { UnauthorizedPage } from '../../pages/Auth/UnauthorizedPage';

interface ProtectedRouteProps {
  requiredRole?: AppRole;
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole = 'ntro_analyst',
  children,
}) => {
  const { user, isLoading } = useAuth();
  const { isNtroAnalyst } = useRole();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-xs text-slate-500 tracking-wider">
          Verifying security clearance...
        </span>
      </div>
    );
  }

  // If unauthenticated: redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If NTRO Analyst role is required but user only has public clearance:
  if (requiredRole === 'ntro_analyst' && !isNtroAnalyst) {
    return <UnauthorizedPage />;
  }

  return children ? <>{children}</> : <Outlet />;
};
