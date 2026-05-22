
interface ChevronDownIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const ChevronDownIcon = ({ width = 16, height = 16, color = "#fff", className }: ChevronDownIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M4 6l4 4 4-4"
      stroke={color}
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default ChevronDownIcon
