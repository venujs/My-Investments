import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Landmark, RotateCcw, TrendingUp, BarChart3,
  Coins, Home, PiggyBank, Target, Calculator,
  Upload, Download, Settings, Repeat, CircleDollarSign, Camera, Receipt, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fd', icon: Landmark, label: 'Fixed Deposits' },
  { to: '/rd', icon: RotateCcw, label: 'Recurring Deposits' },
  { to: '/mutual-funds', icon: TrendingUp, label: 'Mutual Funds' },
  { to: '/shares', icon: BarChart3, label: 'Shares' },
  { to: '/gold', icon: Coins, label: 'Gold' },
  { to: '/loans', icon: CircleDollarSign, label: 'Loans' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/fixed-assets', icon: Home, label: 'Fixed Assets' },
  { to: '/pension', icon: PiggyBank, label: 'Pension' },
  { to: '/savings', icon: Landmark, label: 'Savings Accounts' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/tax', icon: Calculator, label: 'Tax' },
  { to: '/snapshots', icon: Camera, label: 'Snapshots' },
  { to: '/recurring', icon: Repeat, label: 'Recurring' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/export', icon: Download, label: 'Export' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/help', icon: HelpCircle, label: 'Help' },
];

export function Sidebar({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col border-r bg-card', className)}>
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold text-primary">My Investments</h1>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
