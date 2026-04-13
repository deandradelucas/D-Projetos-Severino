import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const images = [
  '/images/horizons/horizon-001.jpg',
  '/images/horizons/horizon-002.jpg',
  '/images/horizons/horizon-005.jpg',
  '/images/horizons/horizon-006.jpg',
  '/images/horizons/horizon-007.jpg',
  '/images/horizons/horizon-008.jpg',
  '/images/horizons/horizon-010.jpg',
  '/images/horizons/horizon-011.jpg',
  '/images/horizons/horizon-012.jpg',
  '/images/horizons/horizon-013.jpg',
  '/images/horizons/horizon-014.jpg',
  '/images/horizons/horizon-015.jpg',
  '/images/horizons/horizon-016.jpg',
  '/images/horizons/horizon-017.jpg',
  '/images/horizons/horizon-018.jpg',
  '/images/horizons/horizon-019.jpg',
  '/images/horizons/horizon-023.jpg',
  '/images/horizons/horizon-024.jpg',
  '/images/horizons/horizon-026.jpg',
  '/images/horizons/horizon-027.jpg',
  '/images/horizons/horizon-028.jpg',
  '/images/horizons/horizon-029.jpg',
  '/images/horizons/horizon-030.jpg',
  '/images/horizons/horizon-031.jpg',
  '/images/horizons/horizon-032.jpg',
  '/images/horizons/horizon-033.jpg',
  '/images/horizons/horizon-034.jpg',
  '/images/horizons/horizon-036.jpg',
  '/images/horizons/horizon-037.jpg',
  '/images/horizons/horizon-038.jpg',
  '/images/horizons/horizon-039.jpg',
  '/images/horizons/horizon-040.jpg',
  '/images/horizons/horizon-042.jpg',
  '/images/horizons/horizon-043.jpg',
  '/images/horizons/horizon-044.jpg',
  '/images/horizons/horizon-046.jpg',
  '/images/horizons/horizon-047.jpg',
  '/images/horizons/horizon-049.jpg',
  '/images/horizons/horizon-050.jpg',
]

function getRandomImage() {
  const randomIndex = Math.floor(Math.random() * images.length)
  return images[randomIndex]
}

export default function Background() {
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const [currentImage, setCurrentImage] = useState(() => getRandomImage())
  /** Telas sem foto de fundo (sólido), p.ex. Configurações e Dashboard inicial */
  const usePlainBackground = pathname === '/configuracoes' || pathname === '/dashboard'

  useEffect(() => {
    if (usePlainBackground) return undefined
    const interval = setInterval(() => {
      setCurrentImage(getRandomImage())
    }, 90000)

    return () => clearInterval(interval)
  }, [usePlainBackground])

  if (usePlainBackground) {
    return (
      <div
        className={`app-background-root app-background-root--plain${theme === 'light' ? ' app-background-root--plain-light' : ' app-background-root--plain-dark'}`}
        aria-hidden
      >
        <div className="app-background-root__plain-fill" />
      </div>
    )
  }

  return (
    <div className="app-background-root" aria-hidden>
      <div
        className="app-background-root__image"
        style={{
          backgroundImage: `url(${currentImage})`,
        }}
      />
      <div
        className={
          theme === 'dark'
            ? 'app-background-root__tint app-background-root__tint--dark'
            : 'app-background-root__tint app-background-root__tint--light'
        }
      />
      <div
        className="app-background-root__vignette"
        style={{
          background: 'radial-gradient(ellipse 90% 75% at 50% 40%, transparent 25%, rgba(12,14,18,0.55) 100%)',
        }}
      />
      <div className="app-background-root__noise" />
    </div>
  )
}
