declare global {
  interface Window {
    electronCompact?: {
      setPinned: (pinned: boolean) => void
      openReport: (sessionId: string, reportId: string) => void
      openMainApp: () => void
    }
  }
}

export {}
