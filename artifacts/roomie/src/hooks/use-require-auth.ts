import { useEffect } from 'react';
import { useLocation } from 'wouter';

export function useRequireAuth(user: any, isLoading: boolean) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/login');
    } else if (!isLoading && user && user.householdId === null) {
      setLocation('/onboard');
    }
  }, [user, isLoading, setLocation]);

  return { user, isLoading };
}
