interface PlusIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const PlusIcon = ({ width = 24, height = 24, color = "#965cdf", className }: PlusIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 5V19M5 12H19"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default PlusIcon

