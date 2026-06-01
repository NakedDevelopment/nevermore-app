import * as React from "react"
import Svg, { Path, SvgProps } from "react-native-svg"

const LinkIcon = ({ color = "#8B5CF6", ...props }: SvgProps) => (
  <Svg width={16} height={16} fill="none" viewBox="0 0 24 24" {...props}>
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
    />
  </Svg>
)

export default LinkIcon
