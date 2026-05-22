import * as React from 'react';

interface CheckCircleIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const CheckCircleIcon: React.FC<CheckCircleIconProps> = ({
  width = 48,
  height = 48,
  color = '#965cdf',
  className = '',
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
      stroke={color}
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 12L10.5 14.5L16 9"
      stroke={color}
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default CheckCircleIcon;

