"use client"
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AIContextType {
  isAITyping: boolean;
  setIsAITyping: React.Dispatch<React.SetStateAction<boolean>>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider = ({ children }: { children: ReactNode }) => {
  const [isAITyping, setIsAITyping] = useState(false);
  return (
    <AIContext.Provider value={{ isAITyping, setIsAITyping }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAIContext = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAIContext must be used within an AIProvider");
  }
  return context;
};
