// Lightweight inline SVG icon set (no external dependency).
// Each icon inherits `currentColor` and accepts standard svg props.

function Svg({ children, size = 20, strokeWidth = 1.7, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CartIcon = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2 3h2.2l2.2 12.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21.5 7H5.2" />
  </Svg>
);

export const HeartIcon = (p) => (
  <Svg {...p}>
    <path d="M20.8 7.6a5 5 0 0 0-8.8-2.2A5 5 0 0 0 3.2 7.6c0 4.2 5.3 8 8.8 10.6 3.5-2.6 8.8-6.4 8.8-10.6Z" />
  </Svg>
);

export const UserIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const SearchIcon = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
);

export const MenuIcon = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const ArrowRightIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ArrowLeftIcon = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const StarIcon = ({ filled, ...p }) => (
  <Svg fill={filled ? "currentColor" : "none"} {...p}>
    <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9Z" />
  </Svg>
);

export const SparkleIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </Svg>
);

export const TruckIcon = (p) => (
  <Svg {...p}>
    <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </Svg>
);

export const BrushIcon = (p) => (
  <Svg {...p}>
    <path d="M14.5 3.5a2.1 2.1 0 0 1 3 3L9 15l-4 1 1-4Z" />
    <path d="M6 16c-1.5 0-3 1.2-3 4 2.8 0 4-1.5 4-3" />
  </Svg>
);

export const PaletteIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="15" cy="8" r="1" fill="currentColor" />
  </Svg>
);

export const FrameIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <rect x="7" y="7" width="10" height="10" rx="1" />
  </Svg>
);

export const ShieldIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const InstagramIcon = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="17" cy="7" r="0.6" fill="currentColor" />
  </Svg>
);

export const FacebookIcon = (p) => (
  <Svg {...p}>
    <path d="M14 8.5h2.3M14 8.5c0-1.6.7-2.5 2.3-2.5M14 8.5V21M14 8.5h-2.3M14 12h2.5M11.7 12H14" />
  </Svg>
);

export const PinterestIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7c-2 0-3.3 1.4-3.3 3.2 0 .9.4 1.9 1.2 2.2.2 0 .2-.1.2-.3l-.1-.6c0-.2 0-.3.1-.4.4-2 1.6-2.6 2.6-2.6 1.4 0 2.3.9 2.3 2.4 0 1.8-.8 3.3-2 3.3-.6 0-1.1-.5-1-1.2.2-.8.5-1.6.5-2.2 0-.5-.3-.9-.8-.9-.7 0-1.2.7-1.2 1.6 0 .6.2 1 .2 1l-.9 3.7c-.2 1-.1 2.2 0 2.3 0 .1.1.1.2 0 .1-.1.8-1 1-2l.4-1.4c.3.5 1 .9 1.7.9 2.2 0 3.8-2 3.8-4.6C16.4 8.8 14.5 7 12 7Z" />
  </Svg>
);

export const PackageIcon = (p) => (
  <Svg {...p}>
    <path d="m12 2 9 5v10l-9 5-9-5V7Z" />
    <path d="M3 7l9 5 9-5M12 12v10" />
  </Svg>
);

export const MapPinIcon = (p) => (
  <Svg {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);

export const MailIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

export const PhoneIcon = (p) => (
  <Svg {...p}>
    <path d="M5 4h3l1.5 5-2 1.5a12 12 0 0 0 6 6l1.5-2 5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />
  </Svg>
);

export const WhatsappIcon = (p) => (
  <Svg {...p}>
    <path d="M3 21l1.6-4.3A8 8 0 1 1 7.6 19.6L3 21Z" />
    <path d="M9 8.5c0 4 2.5 6.5 6.5 6.5.5 0 1-.4 1-1l-.2-1.2-2 .6c-1.5-.6-2.6-1.7-3.2-3.2l.6-2L10.5 7c-.6 0-1 .5-1 1Z" />
  </Svg>
);
