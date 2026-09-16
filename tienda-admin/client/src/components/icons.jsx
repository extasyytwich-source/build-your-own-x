const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconGrid(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

export function IconBox(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  );
}

export function IconReceipt(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function IconTrendingUp(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l4-5 3 3 5-6" />
    </svg>
  );
}

export function IconSettings(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.47.4.9.76 1.24" />
    </svg>
  );
}

export function IconLogOut(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

export function IconLock(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

export function IconStore(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 9.5 5.2 4h13.6l1.2 5.5" />
      <path d="M4 9.5a2.4 2.4 0 0 0 4.8 0 2.4 2.4 0 0 0 4.8 0 2.4 2.4 0 0 0 4.8 0 2.4 2.4 0 0 0 4.8 0" />
      <path d="M5 9.5V20h14V9.5M10 20v-6h4v6" />
    </svg>
  );
}

export function IconCoins(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v10c0 1.66 2.69 3 6 3s6-1.34 6-3V7" />
      <path d="M15 9.5c3 .3 6 1.5 6 3.5v4c0 1.66-2.69 3-6 3-1.3 0-2.5-.22-3.5-.6" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 13.5h3M16 13.5a1.5 1.5 0 0 0 0 3h3v-3Z" />
    </svg>
  );
}

export function IconAlertTriangle(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2.5 18a1.6 1.6 0 0 0 1.4 2.4h16.2a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
    </svg>
  );
}

export function IconCheckCircle(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" />
    </svg>
  );
}

export function IconPlusCircle(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function IconMinusCircle(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function IconWrench(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5V21h3.5l6.3-6.3a4 4 0 0 0 4.9-5.4l-2.8 2.8-2.5-.5-.5-2.5Z" />
    </svg>
  );
}

export function IconSparkles(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

export function IconX(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconCamera(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 8h2.5l1.2-2h8.6l1.2 2H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  );
}

export function IconSend(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3Z" />
      <path d="M10.5 13.5 21 3" />
    </svg>
  );
}

export function IconUsers(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <path d="M16 8.2a3.2 3.2 0 1 1 3 4.4" />
      <path d="M15.5 14.6c2.6.3 4.5 2.3 5 4.9" />
    </svg>
  );
}

export function IconFlash(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function IconBarcode(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props} strokeWidth={1.6}>
      <path d="M4 5v14M8 5v14M11 5v14M15 5v14M17.5 5v14M20 5v14" />
    </svg>
  );
}

export function IconWifi(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M2 8.82a16 16 0 0 1 20 0" />
      <path d="M5 12.6a11 11 0 0 1 14 0" />
      <path d="M8.5 16.4a6 6 0 0 1 7 0" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSmartphone(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.2h2" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function IconDownload(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3v13m0 0-4.5-4.5M12 16l4.5-4.5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

export function IconUpload(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 20V7m0 0-4.5 4.5M12 7l4.5 4.5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

export function IconFileText(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M7 3h7l4 4v14H7Z" />
      <path d="M14 3v4h4M9.5 13h5M9.5 16.5h5" />
    </svg>
  );
}

export function IconChevronDown(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconShieldCheck(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconArrowRight(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconQrCode(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
    </svg>
  );
}

export function IconRefreshCw(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5M20.5 5v3.5H17" />
      <path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5M3.5 19v-3.5H7" />
    </svg>
  );
}
