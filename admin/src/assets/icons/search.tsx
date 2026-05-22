
interface SearchIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const SearchIcon = ({ width = 20, height = 20, color = "#8F8F8F", className }: SearchIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m18 18-3.5-3.5"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default SearchIcon

