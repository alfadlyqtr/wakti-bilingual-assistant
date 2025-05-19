
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return { isMobile }
}

// Add the useMediaQuery hook that is being imported in VoiceSummaryDetailDialog
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState<boolean>(false)
  
  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    
    // Set initial value
    setMatches(mediaQuery.matches)
    
    // Define a callback function to handle changes
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }
    
    // Add the event listener
    mediaQuery.addEventListener("change", handler)
    
    // Remove the event listener on cleanup
    return () => {
      mediaQuery.removeEventListener("change", handler)
    }
  }, [query])
  
  return matches
}
