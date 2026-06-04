import { useState } from 'react'
import { Button } from '@/shared/components/Button'

type RepoUrlInputProps = {
  isLoading?: boolean
  onSubmit: (url: string) => void | Promise<void>
}

export function RepoUrlInput({ isLoading = false, onSubmit }: RepoUrlInputProps) {
  const [url, setUrl] = useState('')

  return (
    <form
      className="section-stack"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmedUrl = url.trim()
        if (!trimmedUrl || isLoading) return
        void onSubmit(trimmedUrl)
      }}
    >
      <label className="field">
        <span>GitLab repository URL</span>
        <input
          type="url"
          value={url}
          placeholder="https://gitlab.com/group/project"
          disabled={isLoading}
          required
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <p className="field-hint">You do not need to upload code or share a personal token.</p>
      <Button type="submit" disabled={isLoading || !url.trim()}>
        {isLoading ? 'Connecting...' : 'Connect repository'}
      </Button>
    </form>
  )
}
