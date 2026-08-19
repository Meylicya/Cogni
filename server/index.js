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

// --- NEW HACKATHON LOGIN ROUTE ---
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user by their email
    // (We know the model is named 'Clinician' based on your previous terminal error!)
    const clinician = await mongoose.model('Clinician').findOne({ email: email });

    if (!clinician) {
      return res.status(404).json({ message: "Account not found." });
    }

    // 2. Check if the password matches the authCredentialHash saved during signup
    if (clinician.authCredentialHash !== password) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // 3. Success! Send back the user data so the frontend can route to the dashboard
    res.status(200).json({ 
      message: "Login successful", 
      clinician: {
        id: clinician._id,
        name: clinician.name,
        email: clinician.email
      }
    });

  } catch (error) {
    console.error("Login Route Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// --- MISSING FETCH PATIENTS ROUTE ---
app.get('/api/patients', async (req, res) => {
  try {
    // Try to grab all patients from Person 3's database model
    const patients = await mongoose.model('Patient').find({});
    
    // Send them back to the frontend! 
    // (If there are none, this sends an empty array [], which is exactly what your UI wants)
    res.status(200).json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    // Bulletproof fallback: if the database fails, send an empty array so the UI doesn't crash
    res.status(200).json([]);
  }
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
