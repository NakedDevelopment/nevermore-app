interface EditIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const EditIcon = ({ width = 20, height = 20, color = "#fff", className }: EditIconProps) => (
<svg color={color} width={width} height={height} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
<path d="M12.8237 2.63545C13.5689 1.82808 13.9415 1.4244 14.3374 1.18893C15.2927 0.620759 16.4691 0.603091 17.4404 1.14232C17.8429 1.3658 18.2269 1.75812 18.995 2.54276C19.7631 3.3274 20.1472 3.71972 20.3659 4.13093C20.8938 5.12312 20.8765 6.32479 20.3203 7.3007C20.0898 7.70516 19.6946 8.08578 18.9043 8.84701L9.50063 17.9043C8.00288 19.3469 7.254 20.0682 6.31806 20.4337C5.38212 20.7993 4.3532 20.7724 2.29536 20.7186L2.01538 20.7113C1.38891 20.6949 1.07567 20.6867 0.893586 20.48C0.711503 20.2734 0.736362 19.9543 0.786079 19.3162L0.813076 18.9697C0.953008 17.1735 1.02297 16.2755 1.37371 15.4682C1.72444 14.6609 2.32944 14.0055 3.53943 12.6945L12.8237 2.63545Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M12.293 3.28906L18.3523 9.3484" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
</svg>

)

export default EditIcon

