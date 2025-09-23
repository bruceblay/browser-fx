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
    padding: '6px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    marginRight: 12,
    marginBottom: 12
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button
        onClick={onClearStreams}
        disabled={false}
        style={{
          ...buttonBaseStyle,
          background: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 12,
          marginRight: 0,
          cursor: 'pointer',
          opacity: 1,
          flex: 1
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
        Clear
      </button>

      {!isCapturing ? (
        <button
          onClick={onCapture}
          style={{
            ...buttonBaseStyle,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'white',
            marginRight: 0,
            flex: 1
          }}
        >
          Start
        </button>
      ) : (
        <button
          onClick={onStop}
          style={{
            ...buttonBaseStyle,
            background: 'rgba(220,53,69,0.15)',
            border: '1px solid rgba(220,53,69,0.3)',
            color: 'white',
            marginRight: 0,
            flex: 1
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          Stop
        </button>
      )}
    </div>
  )
}