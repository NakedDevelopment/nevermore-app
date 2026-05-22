interface MenuIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const MenuIcon = ({ width = 24, height = 24, color = '#fff', className }: MenuIconProps) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <path
      d="M4 7h16M4 12h16M4 17h16"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

export default MenuIcon;
