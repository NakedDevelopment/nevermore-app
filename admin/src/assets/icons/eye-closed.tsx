import * as React from "react"

interface EyeClosedIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const EyeClosedIcon: React.FC<EyeClosedIconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    viewBox="0 0 24 24"
    className={className}
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M22 8s-4 6-10 6S2 8 2 8"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m15 13.5 1.5 2.5M20 11l2 2M2 13l2-2M9 13.5 7.5 16"
    />
  </svg>
)

export default EyeClosedIcon
