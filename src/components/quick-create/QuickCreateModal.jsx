import React, { useEffect, useRef, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EMPTY_INITIAL_DATA = {};

const getInitialFormData = (initialData) => ({ ...(initialData || EMPTY_INITIAL_DATA) });

export default function QuickCreateModal({
  open,
  onOpenChange,
  title,
  createForm,
  onCreate,
  onCreated,
  initialData = EMPTY_INITIAL_DATA,
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setFormData(getInitialFormData(initialData));
      setError("");
    }

    wasOpenRef.current = open;
  }, [initialData, open]);

  const handleClose = () => {
    if (!saving) onOpenChange(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const created = await onCreate(formData);
      await onCreated?.(created);
      onOpenChange(false);
      setFormData(getInitialFormData(initialData));
    } catch (err) {
      setError(err?.message || "Erro ao salvar o cadastro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {typeof createForm === "function"
            ? createForm({ formData, setFormData, disabled: saving })
            : createForm}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
