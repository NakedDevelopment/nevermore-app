interface PlayIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const PlayIcon = ({ width = 32, height = 32, color = "#fff", className }: PlayIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 8L24 16L12 24V8Z"
      fill={color}
    />
  </svg>
)

export default PlayIcon

