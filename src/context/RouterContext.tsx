import React, { createContext, useContext, useState, useEffect } from 'react';

interface RouterContextType {
  currentPath: string;
  search: string;
  navigate: (path: string) => void;
  params: Record<string, string>;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

function splitUrl(rawUrl: string): { pathname: string; search: string } {
  const [pathnamePart, searchPart] = rawUrl.split('?');
  return {
    pathname: pathnamePart || '/',
    search: searchPart ? `?${searchPart}` : '',
  };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      return window.location.pathname;
    }
    return '/';
  });

  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      return window.location.search;
    }
    return '';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setSearch(window.location.search || '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', path);
      } catch (err) {
        console.warn('History pushState restricted in current sandbox, updating state directly', err);
      }
    }
    const parsed = splitUrl(path);
    setCurrentPath(parsed.pathname);
    setSearch(parsed.search);

    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  };

  const params: Record<string, string> = {};
  if (currentPath.startsWith('/student/item/')) {
    const parts = currentPath.split('/');
    if (parts[3]) {
      params.id = parts[3];
    }
  }

  return (
    <RouterContext.Provider value={{ currentPath, search, navigate, params }}>
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
