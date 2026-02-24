import React from 'react';

interface GoogleCalendarLogoProps {
  className?: string;
  size?: number;
}

/**
 * Small Google Calendar logo icon for phone calendar entries on Android
 */
export const GoogleCalendarLogo: React.FC<GoogleCalendarLogoProps> = ({ className = '', size = 8 }) => {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-label="Google Calendar"
    >
      <path fill="#4285F4" d="M148.882 43.618l-47.368-5.263-57.895 5.263L38.355 96.25l5.263 52.632 52.632 5.263 52.632-5.263 5.263-52.632z"/>
      <path fill="#34A853" d="M96.25 148.882l-52.632 5.263L43.618 200l52.632-5.263 52.632 5.263V154.145z"/>
      <path fill="#EA4335" d="M148.882 200V154.145l5.263-5.263L200 148.882v51.118z"/>
      <path fill="#FBBC04" d="M148.882 43.618L200 43.618V0l-51.118 0-5.263 5.263z"/>
      <path fill="#4285F4" d="M43.618 200L0 200l0-51.118 43.618 0z"/>
      <rect fill="#fff" x="60" y="60" width="80" height="80" rx="4"/>
      <path fill="#4285F4" d="M76 88h48v4H76zm0 12h48v4H76zm0 12h32v4H76z"/>
    </svg>
  );
};

export default GoogleCalendarLogo;
