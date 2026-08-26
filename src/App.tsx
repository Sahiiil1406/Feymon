import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function TasksContent() {
  const tasks = useQuery(api.tasks.list) as any[] | undefined
  const createTask = useMutation(api.tasks.create)
  const toggleTask = useMutation(api.tasks.toggle)
  const [title, setTitle] = useState('')
  return (
    <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 16, textAlign: 'left', maxWidth: 480, marginInline: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Realtime Tasks (Convex)</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          createTask({ title: title.trim() })
          setTitle('')
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
        />
        <button type="submit" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #111', background: '#111', color: 'white' }}>
          Add
        </button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {(tasks ?? []).map((t: any) => (
          <li key={t._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px solid #eee', borderRadius: 6 }}>
            <span style={{ textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</span>
            <button onClick={() => toggleTask({ id: t._id })} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: t.completed ? '#10b981' : 'white' }}>
              {t.completed ? 'Undo' : 'Done'}
            </button>
          </li>
        ))}
      </ul>
      {tasks === undefined ? <p>Loading tasks…</p> : tasks.length === 0 ? <p style={{ opacity: 0.7 }}>No tasks yet. Add one above!</p> : null}
    </div>
  )
}

function ConvexTasks() {
  const convexUrl = (import.meta as any).env?.VITE_CONVEX_URL
  if (!convexUrl) {
    return (
      <div style={{ padding: '1rem', border: '1px dashed #ccc', borderRadius: 8, marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Convex not configured</h3>
        <p style={{ margin: '8px 0' }}>
          Add <code>VITE_CONVEX_URL</code> to <code>.env.local</code> and run <code>npx convex dev</code> to enable realtime tasks.
        </p>
        <p style={{ margin: 0, opacity: 0.7 }}>Example: <code>VITE_CONVEX_URL=https://your-deployment.convex.cloud</code></p>
      </div>
    )
  }
  return <TasksContent />
}

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
        <ConvexTasks />
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
