import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';

export type CurrentPerspective = 'PUBLIC' | UserRole;

interface RouterContextType {
  currentPath: string;
  navigate: (path: string) => void;
  params: Record<string, string>;
  perspective: CurrentPerspective;
  setPerspective: (role: CurrentPerspective) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      return window.location.pathname;
    }
    return '/';
  });

  const [perspective, setPerspectiveState] = useState<CurrentPerspective>(() => {
    // Infer initial perspective from URL if already on /student, /admin, or /owner
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/student')) return 'STUDENT';
      if (p.startsWith('/admin') && p !== '/admin-application') return 'COLLEGE_ADMIN';
      if (p.startsWith('/owner')) return 'FOUNDLY_OWNER';
    }
    return 'PUBLIC';
  });

  // Keep browser history in sync
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', path);
      } catch (err) {
        // Fallback for sandboxed iframe environments where pushState might throw
        console.warn('History pushState restricted in current sandbox, updating state directly', err);
      }
    }
    setCurrentPath(path);

    // Auto-update perspective when navigating to role areas
    if (path.startsWith('/student')) {
      setPerspectiveState('STUDENT');
    } else if (path.startsWith('/admin') && path !== '/admin-application') {
      setPerspectiveState('COLLEGE_ADMIN');
    } else if (path.startsWith('/owner')) {
      setPerspectiveState('FOUNDLY_OWNER');
    } else if (path === '/' || path === '/login' || path === '/signup' || path === '/admin-application') {
      // Don't necessarily downgrade if navigating from dashboard back to home, but if going to login/signup, public is natural
      if (path === '/login' || path === '/signup' || path === '/admin-application') {
        setPerspectiveState('PUBLIC');
      }
    }
    
    // Scroll to top
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  };

  const setPerspective = (role: CurrentPerspective) => {
    setPerspectiveState(role);
    if (role === 'STUDENT' && !currentPath.startsWith('/student')) {
      navigate('/student');
    } else if (role === 'COLLEGE_ADMIN' && (!currentPath.startsWith('/admin') || currentPath === '/admin-application')) {
      navigate('/admin');
    } else if (role === 'FOUNDLY_OWNER' && !currentPath.startsWith('/owner')) {
      navigate('/owner');
    } else if (role === 'PUBLIC' && (currentPath.startsWith('/student') || currentPath.startsWith('/admin') || currentPath.startsWith('/owner'))) {
      navigate('/');
    }
  };

  // Extract path parameters, e.g. /student/item/:id
  const params: Record<string, string> = {};
  if (currentPath.startsWith('/student/item/')) {
    const parts = currentPath.split('/');
    if (parts[3]) {
      params.id = parts[3];
    }
  }

  return (
    <RouterContext.Provider value={{ currentPath, navigate, params, perspective, setPerspective }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
