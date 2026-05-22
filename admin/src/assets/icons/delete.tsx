import type { FC } from "react";

interface DeleteIconProps {
    width?: number;
    height?: number;
    color?: string;
    className?: string;
  }

const DeleteIcon: FC<DeleteIconProps> = ({ width = 16, height = 16, color = "#fff", className }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14 3.98568C11.78 3.76568 9.54667 3.65234 7.32 3.65234C6 3.65234 4.68 3.71901 3.36 3.85234L2 3.98568" stroke={color} stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.66797 3.31203L5.81464 2.4387C5.9213 1.80536 6.0013 1.33203 7.12797 1.33203H8.87464C10.0013 1.33203 10.088 1.83203 10.188 2.44536L10.3346 3.31203" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12.5669 6.09375L12.1336 12.8071C12.0603 13.8537 12.0003 14.6671 10.1403 14.6671H5.86026C4.00026 14.6671 3.94026 13.8537 3.86693 12.8071L3.43359 6.09375" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.88672 11H9.10672" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.33203 8.33203H9.66536" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    
  )
}

export default DeleteIcon