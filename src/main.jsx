import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css'
import './index.css'
import App from './app/App.jsx'
import SetupNeeded from './pages/SetupNeeded.jsx'
import { isSupabaseConfigured } from './lib/supabase.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSupabaseConfigured ? <App /> : <SetupNeeded />}
  </React.StrictMode>,
)
