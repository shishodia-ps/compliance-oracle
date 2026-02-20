'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  LayoutDashboard,
  FolderOpen,
  FileText,
  GitCompare,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Quote,
  Home,
  Sparkles,
  Shield,
  Receipt,
  ChevronDown,
  Upload,
  BarChart3,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

const navItems = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/searchai', label: 'SearchAI', icon: Sparkles },
  { href: '/app/due-diligence', label: 'Due Diligence', icon: Shield },
  { href: '/app/matters', label: 'Matters', icon: FolderOpen },
  { href: '/app/documents', label: 'Documents', icon: FileText },
  { href: '/app/citations', label: 'Citations', icon: Quote },
  { href: '/app/compare', label: 'Compare', icon: GitCompare },
  { href: '/app/policy-compare', label: 'Policy Compare', icon: Scale },
  { href: '/app/notifications', label: 'Notifications', icon: Bell },
];

// Settings moved to bottom after Invoices
const settingsItem = { href: '/app/settings', label: 'Settings', icon: Settings };

const externalLinks = [
  { href: '/', label: 'Home Page', icon: Home },
];

// Invoices submenu items
const invoicesSubmenu = [
  { href: '/app/invoices', label: 'Upload Invoices', icon: Upload },
  { href: '/app/invoices/insights', label: 'Insights', icon: BarChart3 },
];

interface AppSidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function AppSidebar({ open, setOpen }: AppSidebarProps) {
  const pathname = usePathname();
  const [invoicesOpen, setInvoicesOpen] = useState(true);

  const isInvoicesActive = pathname === '/app/invoices' || pathname.startsWith('/app/invoices/');

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: open ? 280 : 80 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 bg-white border-r border-slate-200',
          'hidden lg:flex flex-col shadow-sm'
        )}
      >
        {/* Logo */}
        <div className="h-20 flex items-center px-5 border-b border-slate-100">
          <Link href="/app" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            {open && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-semibold text-lg whitespace-nowrap text-slate-900"
              >
                Legal<span className="text-amber-500">AI</span>
              </motion.span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-all group',
                  isActive
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isActive ? "text-amber-600" : "text-slate-400 group-hover:text-slate-600"
                )} />
                {open && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
            );
          })}

          {/* Invoices Section with Submenu */}
          <div className="mt-2">
            <button
              onClick={() => setInvoicesOpen(!invoicesOpen)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group',
                isInvoicesActive
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <Receipt className={cn(
                "w-5 h-5 flex-shrink-0 transition-colors",
                isInvoicesActive ? "text-amber-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {open && (
                <>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium whitespace-nowrap flex-1 text-left"
                  >
                    Invoices
                  </motion.span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    invoicesOpen && "rotate-180"
                  )} />
                </>
              )}
            </button>
            
            <AnimatePresence>
              {open && invoicesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
                    {invoicesSubmenu.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm',
                            isSubActive
                              ? 'bg-amber-50 text-amber-700'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          )}
                        >
                          <subItem.icon className={cn(
                            "w-4 h-4 flex-shrink-0",
                            isSubActive ? "text-amber-600" : "text-slate-400"
                          )} />
                          <span className="font-medium whitespace-nowrap">{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings - At the bottom */}
          <Link
            href={settingsItem.href}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl transition-all group mt-2',
              pathname === settingsItem.href || pathname.startsWith(`${settingsItem.href}/`)
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            <settingsItem.icon className={cn(
              "w-5 h-5 flex-shrink-0 transition-colors",
              pathname === settingsItem.href || pathname.startsWith(`${settingsItem.href}/`)
                ? "text-amber-600" 
                : "text-slate-400 group-hover:text-slate-600"
            )} />
            {open && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium whitespace-nowrap"
              >
                {settingsItem.label}
              </motion.span>
            )}
          </Link>
        </nav>

        {/* External Links -->
        <div className="p-3 border-t border-slate-100">
          {externalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <link.icon className="w-5 h-5 flex-shrink-0" />
              {open && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {link.label}
                </motion.span>
              )}
            </Link>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            className="w-full justify-center lg:justify-start rounded-xl hover:bg-slate-100 text-slate-600"
          >
            {open ? (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="ml-2 text-sm">Collapse</span>
              </>
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full justify-center lg:justify-start text-slate-600 hover:text-red-600 rounded-xl hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            {open && <span className="ml-2 text-sm">Sign out</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 bg-white border-r border-slate-200 shadow-lg',
          'lg:hidden flex flex-col w-72',
          open ? 'translate-x-0' : '-translate-x-full',
          'transition-transform duration-300'
        )}
      >
        <div className="h-20 flex items-center px-5 border-b border-slate-100">
          <Link href="/app" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-slate-900">
              Legal<span className="text-amber-500">AI</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                  isActive
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-amber-600" : "text-slate-400"
                )} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Mobile Invoices Section with Submenu */}
          <div className="mt-2">
            <button
              onClick={() => setInvoicesOpen(!invoicesOpen)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                isInvoicesActive
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <Receipt className={cn(
                "w-5 h-5",
                isInvoicesActive ? "text-amber-600" : "text-slate-400"
              )} />
              <span className="text-sm font-medium flex-1 text-left">Invoices</span>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                invoicesOpen && "rotate-180"
              )} />
            </button>
            
            <AnimatePresence>
              {invoicesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
                    {invoicesSubmenu.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm',
                            isSubActive
                              ? 'bg-amber-50 text-amber-700'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          )}
                        >
                          <subItem.icon className={cn(
                            "w-4 h-4",
                            isSubActive ? "text-amber-600" : "text-slate-400"
                          )} />
                          <span className="font-medium">{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
        <div className="p-3 border-t border-slate-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full justify-start text-slate-600 hover:text-red-600 rounded-xl hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}
