require('dotenv').config();

module.exports = {
  PROJECT_ID: process.env.PROJECT_ID,
  PAT: process.env.PAT,
  API_BASE_URL: 'https://api.jamaibase.com/v1' // Notice the /v1 added
};