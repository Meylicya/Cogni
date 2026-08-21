import 'dotenv/config'; // <-- THIS MUST BE LINE 1! It loads passwords immediately.
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import apiRoutes from './routes/index.js';


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// All other resource routes (like your working signup route), mounted under /api
app.use('/api', apiRoutes);

// Connect to your REAL database using your .env variable!
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to Production MongoDB successfully!');
    // Start the server only after the DB connects
    app.listen(3001, () => {
      console.log('Server is running on port 3001');
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });
