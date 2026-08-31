import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
};

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-teal-800 border-primary",
  secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200",
  outline: "bg-white text-slate-700 hover:bg-slate-50 border-border",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
  destructive: "bg-destructive text-destructive-foreground hover:bg-red-800 border-destructive",
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
