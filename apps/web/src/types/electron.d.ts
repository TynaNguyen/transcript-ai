declare global {
  interface Window {
    electronCompact?: {
      setPinned: (pinned: boolean) => void
    }
  }
}

export {}
