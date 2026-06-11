import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Larger touch-friendly height for mobile / opa-proof forms */
  touchFriendly?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, touchFriendly, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground",
        "transition-[border-color,box-shadow] duration-150",
        "hover:border-border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        touchFriendly
          ? "min-h-[var(--ds-touch-min)] text-base px-4"
          : "h-10",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
