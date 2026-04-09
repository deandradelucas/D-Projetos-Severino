import { useState, useEffect } from 'react'
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
  const [currentImage, setCurrentImage] = useState(() => getRandomImage())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage(getRandomImage())
    }, 90000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="app-background-root" aria-hidden>
      <div
        className="app-background-root__image"
        style={{
          backgroundImage: `url(${currentImage})`,
        }}
      />
      <div
        className={`app-background-root__tint ${theme === 'dark' ? 'app-background-root__tint--dark' : 'app-background-root__tint--light'}`}
      />
      {theme === 'dark' && (
        <div
          className="app-background-root__wash"
          style={{
            background:
              'linear-gradient(165deg, rgba(4,5,7,0.72) 0%, rgba(6,8,12,0.38) 42%, rgba(4,5,8,0.78) 100%), radial-gradient(ellipse 100% 55% at 50% 100%, rgba(212,168,75,0.07), transparent 62%)',
          }}
        />
      )}
      <div
        className="app-background-root__vignette"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(ellipse 85% 70% at 50% 45%, transparent 20%, rgba(2,3,5,0.88) 100%)'
              : 'radial-gradient(ellipse 90% 75% at 50% 40%, transparent 25%, rgba(12,14,18,0.55) 100%)',
        }}
      />
      <div className="app-background-root__noise" />
    </div>
  )
}
