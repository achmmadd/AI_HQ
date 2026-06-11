import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white shadow-sm hover:bg-accent-hover active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground border border-border shadow-xs hover:bg-muted hover:border-border",
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:bg-muted hover:border-border",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive: "bg-error text-white hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-6",
        /** Opa-proof: min 44×44px touch target (see design-system/RULES.md) */
        touch: "min-h-[var(--ds-touch-min)] min-w-[var(--ds-touch-min)] h-11 px-5 text-base",
        icon: "h-10 w-10",
        iconTouch: "min-h-[var(--ds-touch-min)] min-w-[var(--ds-touch-min)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
