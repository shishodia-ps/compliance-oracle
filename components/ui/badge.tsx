import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        success:
          'border-transparent bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        warning:
          'border-transparent bg-amber-500/10 text-amber-400 border-amber-500/20',
        info: 'border-transparent bg-ice-500/10 text-ice-400 border-ice-500/20',
        low: 'border-transparent bg-slate-500/10 text-slate-400 border-slate-500/20',
        medium:
          'border-transparent bg-amber-500/10 text-amber-400 border-amber-500/20',
        high: 'border-transparent bg-orange-500/10 text-orange-400 border-orange-500/20',
        critical:
          'border-transparent bg-red-500/10 text-red-400 border-red-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
