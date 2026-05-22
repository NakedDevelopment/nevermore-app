interface VolumeOffIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const VolumeOffIcon = ({
  width = 24,
  height = 24,
  color = '#fff',
  className,
}: VolumeOffIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Speaker */}
    <path d="M3 9V15H7L12 20V4L7 9H3Z" fill={color} />
    {/* Slash */}
    <path
      d="M4.5 4.5L19.5 19.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default VolumeOffIcon;

