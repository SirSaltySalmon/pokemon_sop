const path = require('path');
const express = require('express');
const cors = require('cors');
const characterRoutes = require('./server/routes/characters');
const tagRoutes = require('./server/routes/tags');
const userRoutes = require('./server/routes/user');
const readmeRoutes = require('./server/routes/readme');

const app = express();
app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(express.static(publicDir));

// API routes
app.use('/api', characterRoutes);
app.use('/api', tagRoutes);
app.use('/api', userRoutes);
app.use('/api', readmeRoutes);

app.listen(3000, () => {
    console.log('Server running on port 3000');
});