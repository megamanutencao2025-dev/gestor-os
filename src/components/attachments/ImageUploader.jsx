import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { UploadFile } from "@/integrations/Core";

export default function ImageUploader({ value = [], onChange, label = "Adicionar imagens", className = "" }) {
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
        if (!/^image\/(png|jpe?g)$/i.test(f.type)) continue;
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
          accept="image/png,image/jpeg,image/jpg"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>
      {(!value || value.length === 0) ? (
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> Nenhuma imagem anexada
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {value.map((img, idx) => (
            <div key={`${img.url}-${idx}`} className="relative group">
              <img
                src={img.url}
                alt={img.nome || `img-${idx}`}
                className="w-full h-20 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="absolute -top-2 -right-2 bg-white border rounded-full p-1 shadow text-slate-600 hover:text-slate-900"
                title="Remover"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}