interface HeaderProps {
  onInfoClick: () => void
}

export function Header({ onInfoClick }: HeaderProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <h1 style={{
        fontSize: 18,
        fontWeight: 'bold',
        margin: 0,
        background: 'linear-gradient(45deg, #fff, #e0e0ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        Browser FX
      </h1>
      <button
        onClick={onInfoClick}
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: 16,
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease'
        }}
        title="About Browser FX"
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        i
      </button>
    </div>
  )
}