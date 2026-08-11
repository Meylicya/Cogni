import express from 'express'
import cors from 'cors'
import 'dotenv/config'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Person 3: score sync endpoint — receives only anonymized, client-encrypted scores
// app.post('/api/scores', ...)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
