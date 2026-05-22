import * as React from 'react';

interface CheckSmallIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const CheckSmallIcon: React.FC<CheckSmallIconProps> = ({
  width = 16,
  height = 12,
  color = '#965cdf',
  className = '',
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 15 11"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="m.75 5.084 4.334 4.333L13.75.75"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default CheckSmallIcon;

