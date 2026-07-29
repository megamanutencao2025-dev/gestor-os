import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText } from "lucide-react";
import { UploadFile } from "@/integrations/Core";

export default function FileUploader({ value = [], onChange, label = "Adicionar arquivos (PDF)", accept = "application/pdf", className = "" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleAddClick = () => inputRef.current?.click();

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      const uploads = [];
      for (const f of files) {
        if (!new RegExp(accept.replace("*", ".*"), "i").test(f.type)) continue;
        const { file_url } = await UploadFile({ file: f });
        uploads.push({
          url: file_url,
          nome: f.name,
          tipo: f.type,
          tamanho: f.size
        });
      }
      const next = [...(value || []), ...uploads];
      onChange?.(next);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeItem = (idx) => {
    const next = (value || []).filter((_, i) => i !== idx);
    onChange?.(next);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleAddClick} disabled={uploading}>
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Enviando..." : label}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>
      {(!value || value.length === 0) ? (
        <div className="text-xs text-slate-500">Nenhum arquivo anexado</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {value.map((doc, idx) => (
            <li key={`${doc.url}-${idx}`} className="flex items-center justify-between gap-3 border rounded px-2 py-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="w-4 h-4 text-slate-600" />
                <a href={doc.url} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">
                  {doc.nome || `arquivo-${idx}.pdf`}
                </a>
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-slate-600 hover:text-slate-900"
                title="Remover"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}