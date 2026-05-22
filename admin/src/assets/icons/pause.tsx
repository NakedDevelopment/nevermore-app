interface PauseIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const PauseIcon = ({ width = 32, height = 32, color = "#fff", className }: PauseIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="10" y="8" width="4" height="16" fill={color} />
    <rect x="18" y="8" width="4" height="16" fill={color} />
  </svg>
)

export default PauseIcon

