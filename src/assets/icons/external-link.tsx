import * as React from "react"
import Svg, { Path, SvgProps } from "react-native-svg"

const ExternalLinkIcon = (props: SvgProps) => (
  <Svg width={20} height={20} fill="none" viewBox="0 0 24 24" {...props}>
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 5h5v5M19 5l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
    />
  </Svg>
)

export default ExternalLinkIcon
