import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateAgentId = (): string => {
  const prefix = 'AGT'; // Prefix for agent ID
  const uniquePart = Math.random().toString(36).substr(2, 8).toUpperCase(); // Generate a random string
  return `${prefix}-${uniquePart}`; // Combine prefix and unique part
};