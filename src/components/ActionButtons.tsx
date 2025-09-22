interface ActionButtonsProps {
  isCapturing: boolean
  onCapture: () => void
  onStop: () => void
  onClearStreams: () => void
}

export function ActionButtons({
  isCapturing,
  onCapture,
  onStop,
  onClearStreams
}: ActionButtonsProps) {
  const buttonBaseStyle = {
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    marginRight: 12,
    marginBottom: 12
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
      {!isCapturing ? (
        <button
          onClick={onCapture}
          style={{
            ...buttonBaseStyle,
            background: 'linear-gradient(45deg, #28a745, #20c997)',
            color: 'white',
            marginRight: 0
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(40, 167, 69, 0.3)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Start
        </button>
      ) : (
        <button
          onClick={onStop}
          style={{
            ...buttonBaseStyle,
            background: 'linear-gradient(45deg, #dc3545, #e83e8c)',
            color: 'white',
            marginRight: 0
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 53, 69, 0.3)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Stop
        </button>
      )}

      <button
        onClick={onClearStreams}
        style={{
          ...buttonBaseStyle,
          background: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)',
          border: '2px solid rgba(255,255,255,0.2)',
          fontSize: 14,
          marginRight: 0
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
          e.currentTarget.style.color = 'white'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
        }}
      >
        Clear All Streams (Debug)
      </button>
    </div>
  )
}