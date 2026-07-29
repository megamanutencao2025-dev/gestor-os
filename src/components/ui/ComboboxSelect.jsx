import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ComboboxSelect({ 
  value, 
  onValueChange, 
  placeholder = "Selecione...",
  emptyMessage = "Nenhum item encontrado.",
  searchPlaceholder = "Pesquisar...",
  items = [],
  getItemValue = (item) => item.id || item.value,
  getItemLabel = (item) => item.nome || item.label || item.descricao,
  getItemSearchText = (item) => `${getItemLabel(item)} ${item.codigo || ''}`.toLowerCase(),
  disabled = false,
  className = ""
}) {
  const [open, setOpen] = useState(false);

  const selectedItem = items.find(item => getItemValue(item) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedItem ? getItemLabel(selectedItem) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {items.map((item) => {
              const itemValue = getItemValue(item);
              const itemLabel = getItemLabel(item);
              
              return (
                <CommandItem
                  key={itemValue}
                  value={getItemSearchText(item)}
                  onSelect={() => {
                    onValueChange(value === itemValue ? "" : itemValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === itemValue ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{itemLabel}</span>
                    {item.codigo && (
                      <span className="text-xs text-muted-foreground">
                        Código: {item.codigo}
                      </span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}