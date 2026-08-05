import { createContext, useContext, useEffect, useState } from 'react'

const RouterContext = createContext(null)

export function RouterProvider({ children }) {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to) => {
    const [toPath, hash] = to.split('#')
    const samePath = toPath === window.location.pathname

    if (!samePath) {
      window.history.pushState({}, '', to)
      setPath(toPath)
    } else if (hash) {
      window.history.pushState({}, '', to)
    }

    if (hash) {
      // Wait a tick for the target page to mount before scrolling to it.
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView()
        }, samePath ? 0 : 50)
      })
    } else if (!samePath) {
      window.scrollTo(0, 0)
    }
  }

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within a RouterProvider')
  return ctx
}

// <Link to="/work/foo"> — behaves like a normal <a> (open in new tab, middle
// click, etc. all still work) but does an in-app navigation on a plain click.
export function Link({ to, children, className, onClick, ...rest }) {
  const { navigate } = useRouter()
  const handleClick = (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
