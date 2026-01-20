import React, { forwardRef } from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', onClick }, ref) => {
    return (
      <div 
        ref={ref}
        className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export function CardHeader({ children, className = '', onClick }: CardProps) {
  return (
    <div className={`px-4 py-3 border-b border-gray-200 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export const CardContent = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', onClick }, ref) => {
    return (
      <div ref={ref} className={`p-4 ${className}`} onClick={onClick}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';
