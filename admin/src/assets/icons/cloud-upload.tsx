interface CloudUploadIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const CloudUploadIcon = ({ width = 48, height = 48, color = "#fff", className }: CloudUploadIconProps) => (
  <svg color={color} width={width} height={height} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M33.2195 38.0839C35.8995 38.1039 38.4795 37.1039 40.4595 35.3039C46.9995 29.5839 43.4995 18.1039 34.8795 17.0239C31.7995 -1.65612 4.85946 5.42388 11.2395 23.2039" stroke={color} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14.5588 24.0237C13.4988 23.4837 12.3188 23.2037 11.1388 23.2237C1.81875 23.8837 1.83875 37.4437 11.1388 38.1037" stroke={color} strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M31.6406 17.863C32.6806 17.343 33.8006 17.063 34.9606 17.043" stroke="white" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24 42V28L20 32" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M24 28L28 32" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>

)

export default CloudUploadIcon

