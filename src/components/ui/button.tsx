import { cn } from "@/lib/utils";

function Button({ className, variant = "default", size = "default", children, ...props }: any) {
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md active:shadow-sm active:scale-[0.98]",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md active:shadow-sm active:scale-[0.98]",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-sm",
    secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:shadow-md active:scale-[0.98]",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
    gradient: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md hover:shadow-lg hover:from-primary/90 hover:to-primary/70 active:shadow-sm active:scale-[0.98]",
  };
  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2 rounded-lg",
    sm: "h-9 rounded-lg px-3",
    lg: "h-11 rounded-lg px-8",
    xl: "h-12 rounded-xl px-8 text-base",
    icon: "h-10 w-10 rounded-lg",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Button };
