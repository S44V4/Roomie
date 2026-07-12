import { Link, useLocation } from 'wouter';
import { Home, CalendarDays, ClipboardList, Receipt, Wallet, LogOut, DoorOpen } from 'lucide-react';
import { useLogout, useGetMe } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const logout = useLogout();

  const [leaving, setLeaving] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = '/login';
      }
    });
  };

  const handleLeaveHousehold = async () => {
    if (!confirm('Leave this household? You can join or create another one afterwards.')) return;
    setLeaving(true);
    try {
      await fetch('/api/households/me/leave', { method: 'DELETE', credentials: 'include' });
      queryClient.clear();
      window.location.href = '/onboard';
    } finally {
      setLeaving(false);
    }
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Today' },
    { href: '/dashboard', icon: CalendarDays, label: 'Dashboard' },
    { href: '/chores', icon: ClipboardList, label: 'Chores' },
    { href: '/expenses', icon: Receipt, label: 'Expenses' },
    { href: '/settle', icon: Wallet, label: 'Settle Up' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="font-serif text-muted-foreground italic">Waking up...</span>
        </div>
      </div>
    );
  }

  if (!user || user.householdId === null) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card/50 backdrop-blur-md sticky top-0 h-screen">
        <div className="p-6">
          <h1 className="font-serif text-2xl tracking-tight text-primary flex items-center gap-2">
            <Home className="w-6 h-6" /> Roomie
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'}`}>
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 mt-auto border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-black/5 transition-colors text-left">
                <Avatar className="w-10 h-10 border shadow-sm">
                  <AvatarFallback className="bg-primary/20 text-primary font-serif">
                    {user?.name?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLeaveHousehold} disabled={leaving} className="cursor-pointer">
                <DoorOpen className="w-4 h-4 mr-2" /> Leave household
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pb-20 md:pb-0 overflow-y-auto">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card/80 backdrop-blur-md sticky top-0 z-10 border-b">
          <h1 className="font-serif text-xl tracking-tight text-primary flex items-center gap-2">
            <Home className="w-5 h-5" /> Roomie
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="outline-none">
                <Avatar className="w-8 h-8 border shadow-sm">
                  <AvatarFallback className="bg-primary/20 text-primary font-serif">
                    {user?.name?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLeaveHousehold} disabled={leaving} className="cursor-pointer">
                <DoorOpen className="w-4 h-4 mr-2" /> Leave household
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex items-center justify-around p-2 pb-safe z-50">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 p-2 rounded-xl flex-1 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`p-1 rounded-full ${isActive ? 'bg-primary/10' : 'transparent'}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
