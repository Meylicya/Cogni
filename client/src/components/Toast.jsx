/**
 * Toast — fixed-position feedback banner, always visible without
 * scrolling regardless of form length or scroll position. Used across
 * clinician/caregiver pages instead of each one inventing its own
 * "success message buried at the bottom of a long form" pattern.
 *
 * @param {Object} props
 * @param {'success'|'error'} [props.kind='success']
 * @param {string} props.message
 * @param {() => void} [props.onDismiss] - shows a close (×) button if provided
 */
export default function Toast({ kind = 'success', message, onDismiss }) {
  const isSuccess = kind === 'success'

  return (
    <div
      className="harbor-toast-enter"
      style={{
        position: 'fixed',
        top: 24,
        left: '50%',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 460,
        padding: '14px 18px',
        borderRadius: 12,
        background: isSuccess ? '#1E3A4C' : '#c5221f',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(30, 58, 76, 0.25)',
        fontFamily: "'Work Sans', sans-serif",
        fontSize: 14,
      }}
      role="status"
    >
      <CheckOrAlertIcon isSuccess={isSuccess} />
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

function CheckOrAlertIcon({ isSuccess }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="1.4" opacity="0.4" />
      {isSuccess ? (
        <path d="M6 10.5l2.5 2.5L14 7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M10 6v5M10 14v.01" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  )
}
