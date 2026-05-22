import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../store';

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ 
  children, 
  redirectTo = '/content-management' 
}) => {
  const { user, isLoading, checkAuth } = useStore();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Ensure auth is checked on mount (only once per route)
  useEffect(() => {
    if (!hasCheckedAuth) {
      checkAuth().finally(() => setHasCheckedAuth(true));
    }
  }, [checkAuth, hasCheckedAuth]);

  // Show loading state while checking authentication
  if (isLoading || !hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Redirect to dashboard/content-management if already authenticated
  // (Don't use 'from' here - that's only for post-sign-in redirect)
  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Render public content if not authenticated
  return <>{children}</>;
};

