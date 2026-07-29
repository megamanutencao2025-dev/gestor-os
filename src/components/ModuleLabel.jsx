import { cn } from "@/lib/utils";

export default function ModuleLabel({ children, className }) {
  return (
    <div className={cn("text-sm font-medium leading-none text-slate-900", className)}>
      {children}
    </div>
  );
}
