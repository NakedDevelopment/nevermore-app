interface AccessCodesIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const AccessCodesIcon = ({ width = 24, height = 24, color = "#fff", className }: AccessCodesIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M14.5 2.5a5 5 0 1 0 2.5 9.34L19 14l2 2-2 2-1-1-2 2-2-2 1-1-4.34-4.34A5 5 0 0 0 14.5 2.5Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 7.5h.01"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default AccessCodesIcon;
