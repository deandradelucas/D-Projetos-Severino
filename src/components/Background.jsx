import { useState, useEffect } from 'react'

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
  const [currentImage, setCurrentImage] = useState(() => getRandomImage())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage(getRandomImage())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div 
      className="fixed inset-0 -z-10"
      style={{
        backgroundImage: `url(${currentImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'background-image 0.5s ease-in-out',
      }}
    >
      <div className="absolute inset-0 bg-black/60" />
    </div>
  )
}
