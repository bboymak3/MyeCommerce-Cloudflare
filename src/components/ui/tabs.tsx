import { cn } from "@/lib/utils";

function Tabs({ className, children, ...props }: any) {
  return <div className={cn("", className)} {...props}>{children}</div>;
}

function TabsList({ className, children, ...props }: any) {
  return (
    <div className={cn("inline-flex items-center justify-center rounded-md bg-muted p-1.5 text-muted-foreground flex-wrap gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}

function TabsTrigger({ className, children, value, activeTab, setActiveTab, ...props }: any) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-[36px]",
        activeTab === value ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50",
        className
      )}
      onClick={() => setActiveTab(value)}
      {...props}
    >
      {children}
    </button>
  );
}

function TabsContent({ className, children, value, activeTab, ...props }: any) {
  if (activeTab !== value) return null;
  return (
    <div className={cn("mt-2", className)} {...props}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
