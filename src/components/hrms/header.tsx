'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { getNotifications, markNotificationRead } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/types';
import type { CompanyInfo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Menu, Search, Bell, Moon, Sun, LogOut, User, Settings, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationData {
  id: string; title: string; message: string; type: string; category: string;
  isRead: boolean; createdAt: string; actionUrl: string | null;
}

export function Header() {
  const {
    userRole, userName, userEmail, currentCompany, companies, user,
    setCurrentCompany, toggleDarkMode, darkMode,
    sidebarOpen, setSidebarOpen, logout, setActiveModule, setNotificationCount,
  } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getNotifications(user.id)
      .then((res) => {
        if (cancelled) return;
        const data = res as { notifications: NotificationData[]; unreadCount: number };
        setNotifications(data.notifications || []);
        setNotificationCount(data.unreadCount || 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setNotificationCount(Math.max(0, (notifications.filter(n => !n.isRead).length) - 1));
    } catch {
      // silently fail
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-4 gap-3">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Company Switcher */}
      <div className="shrink-0 hidden sm:block">
        <Select
          value={currentCompany?.id || ''}
          onValueChange={(id) => {
            const company = companies.find(c => c.id === id);
            if (company) setCurrentCompany(company);
          }}
        >
          <SelectTrigger className="w-[200px] h-9 text-sm border-border">
            <div className="flex items-center gap-2 truncate">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded flex items-center justify-center shrink-0">
                <span className="text-white text-[9px] font-bold">{currentCompany?.code || 'TC'}</span>
              </div>
              <span className="truncate">{currentCompany?.name || 'Select Company'}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {companies.filter((c: CompanyInfo) => c.id && c.id.trim()).map((c: CompanyInfo) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs">({c.employeeCount} employees)</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees, modules, actions..."
            className="pl-9 h-9 bg-background/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      {/* Right section */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Mobile company info */}
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-1">
                <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">{currentCompany?.code?.slice(0,2) || 'TC'}</span>
                </div>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {companies.map((c: CompanyInfo) => (
                <DropdownMenuItem key={c.id} onClick={() => setCurrentCompany(c)}>
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Dark Mode Toggle */}
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {notifications.filter(n => !n.isRead).length > 9 ? '9+' : notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Badge variant="secondary" className="text-xs">{notifications.filter(n => !n.isRead).length} new</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-y-auto">
              {notifications.length > 0 ? notifications.slice(0, 10).map(n => (
                <DropdownMenuItem
                  key={n.id}
                  className={`flex flex-col items-start gap-1 p-3 ${!n.isRead ? 'bg-accent/50' : ''}`}
                  onClick={() => handleMarkRead(n.id)}
                >
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.message || (n.createdAt ? new Date(n.createdAt).toLocaleString() : '')}</span>
                </DropdownMenuItem>
              )) : (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  No notifications
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center text-emerald-600 font-medium justify-center">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-emerald-600 text-white text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-medium leading-tight">{userName}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[userRole]}</span>
              </div>
              <ChevronDown className="h-3 w-3 hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{userName}</span>
                <span className="text-xs text-muted-foreground">{userEmail}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveModule('settings')}>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveModule('settings')}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
