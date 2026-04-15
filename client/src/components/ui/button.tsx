import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'btn-elevated-primary bg-primary text-primary-foreground hover:-translate-y-px hover:bg-primary/95',
        destructive:
          'btn-elevated-destructive bg-destructive text-destructive-foreground hover:-translate-y-px hover:bg-destructive/95',
        outline:
          'border-input bg-card/88 text-foreground shadow-operational hover:-translate-y-px hover:bg-secondary/80',
        secondary:
          'border-border/80 bg-secondary text-secondary-foreground shadow-operational hover:-translate-y-px hover:bg-secondary/92',
        ghost: 'text-muted-foreground hover:bg-secondary/72 hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
}

export { Button };
