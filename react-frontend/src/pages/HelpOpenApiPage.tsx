import { useEffect, useRef } from 'react'
import PageBackNav from '../components/PageBackNav'

declare global {
  interface Window {
    SwaggerUIBundle?: (opts: Record<string, unknown>) => unknown
  }
}

const SWAGGER_CSS = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css'
const SWAGGER_BUNDLE = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js'

export default function HelpOpenApiPage() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = SWAGGER_CSS
    link.id = 'swagger-ui-stylesheet'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = SWAGGER_BUNDLE
    script.async = true
    script.id = 'swagger-ui-script'
    script.onload = () => {
      if (cancelled) return
      const el = rootRef.current
      const SB = window.SwaggerUIBundle
      if (!el || !SB) return
      el.innerHTML = ''
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
      void SB({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui-root',
        deepLinking: true,
        tryItOutEnabled: true,
        requestInterceptor: (req: { headers?: Record<string, string> }) => {
          const next = { ...req }
          next.headers = { ...next.headers, Accept: 'application/json' }
          if (token) {
            next.headers.Authorization = `Bearer ${token}`
          }
          return next
        },
      })
    }
    document.body.appendChild(script)

    return () => {
      cancelled = true
      document.getElementById('swagger-ui-stylesheet')?.remove()
      document.getElementById('swagger-ui-script')?.remove()
      if (rootRef.current) rootRef.current.innerHTML = ''
    }
  }, [])

  return (
    <div>
      <PageBackNav back={{ to: '/', label: 'Tableau de bord' }} />
      <div className="card" style={{ marginBottom: '1rem', maxWidth: '62rem' }}>
        <h1 style={{ marginTop: 0 }}>Aide — API OpenAPI</h1>
        <p style={{ color: 'var(--color-muted)', lineHeight: 1.55, marginBottom: 0 }}>
          Schéma généré côté serveur (<code>GET /api/openapi.json</code>). Les requêtes « Try it out » réutilisent votre
          session si vous êtes connecté (jeton Sanctum du navigateur).
        </p>
      </div>
      <div className="card swagger-ui-host">
        <div id="swagger-ui-root" ref={rootRef} />
      </div>
    </div>
  )
}
