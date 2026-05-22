interface ChevronLeftIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const ChevronLeftIcon = ({ width = 24, height = 24, color = "#fff", className }: ChevronLeftIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M15 18l-6-6 6-6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default ChevronLeftIcon
