import { useTheme } from '../context/ThemeContext'

export default function Background() {
  const { theme } = useTheme()

  return (
    <div
      className={`app-background-root app-background-root--plain${theme === 'light' ? ' app-background-root--plain-light' : ' app-background-root--plain-dark'}`}
      aria-hidden
    >
      <div className="app-background-root__plain-fill" />
    </div>
  )
}
