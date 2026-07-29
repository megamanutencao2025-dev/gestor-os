import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Clock } from "lucide-react";

/**
 * Componente compacto de entrada de duração com formato HH:mm
 * @param {number} value - Valor em horas decimais (ex: 2.5)
 * @param {function} onChange - Callback quando o valor muda (recebe horas decimais)
 * @param {number} minuteStep - Incremento de minutos (padrão: 15)
 * @param {string} className - Classes CSS adicionais
 */
export default function DurationInput({ 
  value = 0, 
  onChange, 
  minuteStep = 15,
  className = "",
  placeholder = "00:00"
}) {
  // Converter decimal para HH:MM
  const decimalToHHMM = (decimal) => {
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    return {
      hours: hours,
      minutes: minutes,
      formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    };
  };

  // Converter HH:MM para decimal
  const hhmmToDecimal = (hours, minutes) => {
    return hours + (minutes / 60);
  };

  const { hours: initialHours, minutes: initialMinutes, formatted } = decimalToHHMM(value);
  
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [timeString, setTimeString] = useState(formatted);

  // Atualizar quando o value prop mudar
  useEffect(() => {
    const { hours: h, minutes: m, formatted: f } = decimalToHHMM(value);
    setHours(h);
    setMinutes(m);
    setTimeString(f);
  }, [value]);

  // Notificar mudança
  const notifyChange = (newHours, newMinutes) => {
    const decimal = hhmmToDecimal(newHours, newMinutes);
    if (onChange) {
      onChange(decimal);
    }
  };

  // Handler para input direto HH:MM
  const handleTimeStringChange = (e) => {
    const val = e.target.value;
    setTimeString(val);

    // Tentar parsear HH:MM
    const match = val.match(/^(\d{1,3}):(\d{2})$/);
    if (match) {
      const h = parseInt(match[1]) || 0;
      const m = parseInt(match[2]) || 0;
      
      if (m < 60) {
        setHours(h);
        setMinutes(m);
        notifyChange(h, m);
      }
    }
  };

  // Incrementar/decrementar
  const adjust = (delta) => {
    let newMinutes = minutes + (delta * minuteStep);
    let newHours = hours;
    
    // Ajustar overflow/underflow
    if (newMinutes >= 60) {
      newHours += Math.floor(newMinutes / 60);
      newMinutes = newMinutes % 60;
    } else if (newMinutes < 0) {
      const hoursToSubtract = Math.ceil(Math.abs(newMinutes) / 60);
      newHours = Math.max(0, newHours - hoursToSubtract);
      if (newHours === 0) {
        newMinutes = 0;
      } else {
        newMinutes = 60 - (Math.abs(newMinutes) % 60);
        if (newMinutes === 60) {
          newMinutes = 0;
          newHours++;
        }
      }
    }
    
    if (newHours < 0) {
      newHours = 0;
      newMinutes = 0;
    }
    
    setHours(newHours);
    setMinutes(newMinutes);
    const newFormatted = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    setTimeString(newFormatted);
    notifyChange(newHours, newMinutes);
  };

  // Suporte a teclado
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjust(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjust(-1);
    }
  };

  const decimalValue = hhmmToDecimal(hours, minutes);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Ícone */}
      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
      
      {/* Input HH:MM */}
      <Input
        type="text"
        value={timeString}
        onChange={handleTimeStringChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-20 h-8 text-center font-mono text-sm"
        aria-label="Duração em horas e minutos"
      />

      {/* Botões de incremento/decremento */}
      <div className="flex flex-col gap-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => adjust(1)}
          className="h-4 w-6 p-0 rounded-b-none"
          aria-label={`Adicionar ${minuteStep} minutos`}
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => adjust(-1)}
          className="h-4 w-6 p-0 rounded-t-none border-t-0"
          aria-label={`Subtrair ${minuteStep} minutos`}
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
      </div>

      {/* Exibição decimal (read-only) */}
      <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
        <span>=</span>
        <span className="font-mono font-medium">{decimalValue.toFixed(2)}</span>
        <span>h</span>
      </div>
    </div>
  );
}