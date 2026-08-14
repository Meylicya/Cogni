import { Link } from 'react-router-dom';

export const backButtonStyle = {
  display: 'block',
  background: 'none',
  border: 'none',
  color: 'var(--harbor-teal)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "'Work Sans', sans-serif",
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
  textDecoration: 'none',
};

/**
 * Harbor-styled back navigation. Pass `to` for SPA route links, `onClick` for in-page actions.
 */
export default function BackButton({ to, onClick, children = '← Back', style, className }) {
  const combinedStyle = { ...backButtonStyle, ...style };

  if (to != null) {
    return (
      <Link to={to} style={combinedStyle} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} style={combinedStyle} className={className}>
      {children}
    </button>
  );
}
