import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function QuickCreateButton({
  label = "Novo cadastro",
  className,
  ...props
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("shrink-0", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Plus aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
