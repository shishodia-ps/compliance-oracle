'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, AlertOctagon, TrendingUp, TrendingDown } from 'lucide-react';
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
type Trend = 'up' | 'down' | 'neutral';

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  className?: string;
}

/**
 * Risk Badge Component
 * Visual indicator for risk severity
 */
export function RiskBadge({ level, label, className }: RiskBadgeProps) {
  const config: Record<RiskLevel, { bg: string; text: string; border: string; icon: ReactNode }> = {
    critical: {
      bg: 'bg-red-100 dark:bg-red-950/30',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-300 dark:border-red-800',
      icon: <AlertOctagon className="w-4 h-4" />,
    },
    high: {
      bg: 'bg-orange-100 dark:bg-orange-950/30',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-300 dark:border-orange-800',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    medium: {
      bg: 'bg-yellow-100 dark:bg-yellow-950/30',
      text: 'text-yellow-700 dark:text-yellow-300',
      border: 'border-yellow-300 dark:border-yellow-800',
      icon: <AlertCircle className="w-4 h-4" />,
    },
    low: {
      bg: 'bg-green-100 dark:bg-green-950/30',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-300 dark:border-green-800',
      icon: null,
    },
    info: {
      bg: 'bg-blue-100 dark:bg-blue-950/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-300 dark:border-blue-800',
      icon: null,
    },
  };

  const c = config[level];
  const displayLabel = label || level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border',
        c.bg,
        c.text,
        c.border,
        className
      )}
    >
      {c.icon}
      {displayLabel}
    </span>
  );
}

interface RiskIndicatorProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Risk Indicator - Just the colored dot
 * Compact risk level indicator
 */
export function RiskIndicator({ level, size = 'md', className }: RiskIndicatorProps) {
  const colors: Record<RiskLevel, string> = {
    critical: 'bg-red-600',
    high: 'bg-orange-600',
    medium: 'bg-yellow-600',
    low: 'bg-green-600',
    info: 'bg-blue-600',
  };

  const sizes: Record<string, string> = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div
      className={cn('rounded-full', colors[level], sizes[size], className)}
      title={level}
    />
  );
}

interface RiskHeatProps {
  level: RiskLevel;
  className?: string;
}

/**
 * Risk Heat Map Cell
 * Shows risk level as a colored cell
 */
export function RiskHeatCell({ level, className }: RiskHeatProps) {
  const colors: Record<RiskLevel, string> = {
    critical: 'bg-red-600 hover:bg-red-700',
    high: 'bg-orange-600 hover:bg-orange-700',
    medium: 'bg-yellow-600 hover:bg-yellow-700',
    low: 'bg-green-600 hover:bg-green-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <div
      className={cn(
        'rounded transition-colors cursor-pointer',
        colors[level],
        className
      )}
      title={level}
    />
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    direction: Trend;
  };
  description?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Stat Card Component
 * Enhanced dashboard card with icon, trend, and visual appeal
 */
export function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all hover:shadow-lg',
        onClick && 'cursor-pointer hover:border-brand-500',
        className
      )}
      onClick={onClick}
    >
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-400 to-brand-600" />

      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="p-2 bg-brand-100 dark:bg-brand-950/30 rounded-lg">
            <div className="w-5 h-5 text-brand-600 dark:text-brand-400">
              {icon}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-6">
        <div className="space-y-3">
          <div>
            <p className="text-3xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>

          {trend && (
            <div className="flex items-center gap-1.5 pt-2">
              <div
                className={cn(
                  'inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium',
                  trend.direction === 'up'
                    ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                )}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.direction === 'up' ? '+' : ''}{trend.value}%
              </div>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface RiskSummaryProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
  className?: string;
}

/**
 * Risk Summary
 * Overview of all risk levels at a glance
 */
export function RiskSummary({
  critical,
  high,
  medium,
  low,
  className,
}: RiskSummaryProps) {
  const total = critical + high + medium + low;
  const criticalPct = total > 0 ? ((critical / total) * 100).toFixed(0) : 0;
  const highPct = total > 0 ? ((high / total) * 100).toFixed(0) : 0;
  const mediumPct = total > 0 ? ((medium / total) * 100).toFixed(0) : 0;
  const lowPct = total > 0 ? ((low / total) * 100).toFixed(0) : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Risk Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total Risks</span>
          <span className="text-2xl font-bold">{total}</span>
        </div>

        <div className="space-y-3">
          {critical > 0 && (
            <RiskLevelRow level="critical" count={critical} percentage={criticalPct as any} />
          )}
          {high > 0 && (
            <RiskLevelRow level="high" count={high} percentage={highPct as any} />
          )}
          {medium > 0 && (
            <RiskLevelRow level="medium" count={medium} percentage={mediumPct as any} />
          )}
          {low > 0 && (
            <RiskLevelRow level="low" count={low} percentage={lowPct as any} />
          )}
        </div>

        {total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No risks detected
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface RiskLevelRowProps {
  level: RiskLevel;
  count: number;
  percentage: number;
}

function RiskLevelRow({ level, count, percentage }: RiskLevelRowProps) {
  const colors: Record<RiskLevel, string> = {
    critical: 'bg-red-600',
    high: 'bg-orange-600',
    medium: 'bg-yellow-600',
    low: 'bg-green-600',
    info: 'bg-blue-600',
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="capitalize font-medium">{level}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={cn('h-full rounded-full transition-all', colors[level])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
