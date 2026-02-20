'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  Bell,
  Search,
  Plus,
  FileText,
  User,
  AlertCircle,
  CheckCircle,
  Check,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';
import { formatDistanceToNow } from '@/lib/utils';

interface AppHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface Notification {
  id: string;
  type: 'upload' | 'analysis' | 'user' | 'risk';
  message: string;
  timestamp: string;
  read: boolean;
}

export function AppHeader({ sidebarOpen, setSidebarOpen }: AppHeaderProps) {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/notifications', { signal });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications?.filter((n: Notification) => !n.read).length || 0);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Failed to fetch notifications');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchNotifications(controller.signal);
    const interval = setInterval(() => fetchNotifications(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read');
    }
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'analysis':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'risk':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default:
        return <User className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <header 
      className="fixed top-0 right-0 h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200 z-30 transition-all duration-300"
      style={{ left: sidebarOpen ? '280px' : '80px' }}
    >
      <div className="h-full flex items-center justify-between px-6">
        {/* Left: Mobile menu & Search */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-600 hover:text-slate-900"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search documents, matters..."
              className="w-64 h-6 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400 text-slate-900"
            />
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-3">
          <Link href="/app/documents/upload">
            <Button size="sm" className="hidden sm:flex bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </Link>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-slate-600 hover:text-slate-900">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 bg-white border-slate-200 max-h-[400px] overflow-hidden" align="end">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-amber-600">{unreadCount} new</span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">
                  No notifications
                </div>
              ) : (
                <>
                  {unreadCount > 0 && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs text-amber-600 justify-center"
                      onClick={async () => {
                        try {
                          await fetch('/api/notifications/read-all', { method: 'POST' });
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                          setUnreadCount(0);
                        } catch (e) {
                          console.error('Failed to mark all as read');
                        }
                      }}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Mark all as read
                    </DropdownMenuItem>
                  )}
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`cursor-pointer ${!notification.read ? 'bg-amber-50' : ''}`}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3 py-2">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!notification.read ? 'font-medium' : ''} text-slate-800 truncate`}>
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDistanceToNow(notification.timestamp)}
                            </p>
                          </div>
                          {!notification.read && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-slate-100 text-slate-600 text-sm">
                    {session?.user?.name ? getInitials(session.user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white border-slate-200" align="end" forceMount>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-slate-900">{session?.user?.name}</p>
                  <p className="text-xs text-slate-500">
                    {session?.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem asChild className="text-slate-700 hover:bg-slate-50 cursor-pointer">
                <Link href="/app/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-slate-700 hover:bg-slate-50 cursor-pointer">
                <Link href="/">Back to Website</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
