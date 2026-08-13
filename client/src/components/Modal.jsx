/**
 * Modal — centered overlay for messages that need more presence than a
 * Toast (a call-to-action button, a longer explanation, or something the
 * person shouldn't miss). Toast stays for brief transient confirmations;
 * Modal is for "stop and look at this" moments like a safety-gate result.
 *
 * @param {Object} props
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 */
export default function Modal({ onClose, children }) {
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div
        className="harbor-card harbor-fade-in"
        style={styles.window}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button onClick={onClose} aria-label="Close" style={styles.closeButton}>
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(30, 58, 76, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    zIndex: 1100,
  },
  window: {
    position: 'relative',
    maxWidth: 440,
    width: '100%',
    padding: '2rem',
    fontFamily: "'Work Sans', sans-serif",
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    background: 'none',
    border: 'none',
    fontSize: 22,
    lineHeight: 1,
    color: '#7C8B93',
    cursor: 'pointer',
    padding: 0,
  },
}
