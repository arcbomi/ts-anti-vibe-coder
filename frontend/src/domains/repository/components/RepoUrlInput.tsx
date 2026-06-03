import { useState } from 'react'
import { Button } from '@/shared/components/Button'

export function RepoUrlInput({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(url)
      }}
    >
      <label>
        GitLab Repository URL
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <Button type="submit">Connect</Button>
    </form>
  )
}
