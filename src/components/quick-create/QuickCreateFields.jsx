import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function QuickCreateFields({ fields = [], formData = {}, setFormData, disabled = false }) {
  const updateField = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const fieldId = `quick-create-${field.name}`;
        const value = formData[field.name] ?? "";

        return (
          <div key={field.name}>
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>

            {field.type === "textarea" ? (
              <Textarea
                id={fieldId}
                value={value}
                onChange={(event) => updateField(field.name, event.target.value)}
                placeholder={field.placeholder}
                rows={field.rows || 3}
                disabled={disabled}
              />
            ) : field.type === "select" ? (
              <Select
                value={value}
                onValueChange={(nextValue) => updateField(field.name, nextValue)}
                disabled={disabled}
              >
                <SelectTrigger id={fieldId}>
                  <SelectValue placeholder={field.placeholder || "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options || []).map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={fieldId}
                type={field.type || "text"}
                min={field.min}
                step={field.step}
                value={value}
                onChange={(event) => updateField(field.name, event.target.value)}
                placeholder={field.placeholder}
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
