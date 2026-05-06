import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import analysisRoutes from './routes/analysis.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', analysisRoutes);

app.get('/', (req, res) => {
  res.json({ status: "VerityWave AI Detection Service Running" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`>> VerityWave Backend active on http://localhost:${PORT}`);
});
