import React, { useState } from "react";

export const TooltipProvider = ({ children, delayDuration = 0 }) => {
  return <>{children}</>;
};

export const Tooltip = ({ children }) => {
  return <>{children}</>;
};

export const TooltipTrigger = ({ asChild, children, ...props }) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return <div {...props}>{children}</div>;
};

export const TooltipContent = ({ side = "right", className = "", children, style, ...props }) => {
  const sideStyles = {
    top: { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "8px" },
    bottom: { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: "8px" },
    left: { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: "8px" },
    right: { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: "8px" },
  };

  return (
    <div
      className={`absolute z-50 overflow-hidden rounded-md border bg-slate-900 text-white px-3 py-1.5 text-sm shadow-md whitespace-nowrap ${className}`}
      style={{ ...sideStyles[side], ...style }}
      {...props}
    >
      {children}
    </div>
  );
};

// Hook customizado para gerenciar tooltip
export const useTooltip = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  return {
    isVisible,
    show: () => setIsVisible(true),
    hide: () => setIsVisible(false),
  };
};