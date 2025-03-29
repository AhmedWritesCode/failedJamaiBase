const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { PROJECT_ID, PAT, API_BASE_URL } = require('./config');
const logger = require('./logger');

class ReceiptProcessor {
  constructor() {
    if (!PROJECT_ID || !PAT) {
      throw new Error('Missing required environment variables: PROJECT_ID and PAT must be set');
    }

    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Project-ID': PROJECT_ID,
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      // Add these for debugging:
      transformRequest: [(data, headers) => {
        logger.debug('Making request to:', headers.common.Authorization ? 
          `${headers.common['Project-ID']}@${this.client.defaults.baseURL}` : 
          this.client.defaults.baseURL);
        logger.debug('Request data:', data);
        return JSON.stringify(data);
      }],
      transformResponse: [(data) => {
        logger.debug('Received response:', data);
        return data;
      }]
    });

    this.fileClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Project-ID': PROJECT_ID,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    });
  }

  async validateEnvironment() {
    try {
      logger.info('Validating environment...');
      
      // Check if the receipt table exists
      const response = await this.client.get('/v1/tables', {
        params: {
          table_type: 'action'
        }
      });
      
      const tableExists = response.data.tables.some(table => table.table_id === 'receipt');
      if (!tableExists) {
        throw new Error('Action table "receipt" does not exist in your project');
      }
      
      logger.info('Environment validation successful');
      return true;
    } catch (error) {
      logger.error(`Environment validation failed: ${error.message}`);
      throw error;
    }
  }

  async validateImage(imagePath) {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image not found: ${imagePath}`);
      }

      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const fileExt = path.extname(imagePath).toLowerCase();
      
      if (!validExtensions.includes(fileExt)) {
        throw new Error(`Unsupported file format. Use: ${validExtensions.join(', ')}`);
      }

      logger.debug(`Image validation passed for: ${imagePath}`);
      return true;
    } catch (error) {
      logger.error(`Image validation failed: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(filePath) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), path.basename(filePath));

      logger.debug(`Starting file upload: ${filePath}`);
      const response = await this.fileClient.post('/v1/files', formData, {
        headers: formData.getHeaders()
      });

      logger.debug(`File uploaded successfully: ${response.data.uri}`);
      return response.data;
    } catch (error) {
      logger.error(`File upload failed: ${error.message}`);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async processReceipt(imagePath) {
    try {
      await this.validateEnvironment();
      await this.validateImage(imagePath);
      logger.info(`Processing receipt: ${path.basename(imagePath)}`);

      const fileResponse = await this.uploadFile(imagePath);
      
      logger.debug('Extracting receipt information...');
      const response = await this.client.post('/v1/tables/rows', {
        table_type: 'action',
        request: {
          table_id: "receipt",
          data: [{ "Image": fileResponse.uri }],
          stream: false
        }
      });

      const row = response.data.rows[0];
      const results = {
        shop_name: row.columns["Shop Name"]?.text || 'N/A',
        total: row.columns["Total"]?.text || 'N/A'
      };

      logger.info(`Processing complete for: ${path.basename(imagePath)}`);
      return results;

    } catch (error) {
      logger.error(`Error processing receipt ${path.basename(imagePath)}: ${error.message}`);
      return null;
    }
  }

  async processReceiptBatch(folderPath) {
    try {
      await this.validateEnvironment();
      logger.info(`Starting batch processing for folder: ${folderPath}`);

      const files = fs.readdirSync(folderPath);
      const results = [];

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(path.extname(file).toLowerCase())) {
          const result = await this.processReceipt(filePath);
          if (result) {
            results.push({
              filename: file,
              ...result
            });
          }
        }
      }

      logger.info(`Batch processing completed. ${results.length} receipts processed`);
      return results;

    } catch (error) {
      logger.error(`Batch processing failed: ${error.message}`);
      return [];
    }
  }
}

module.exports = ReceiptProcessor;