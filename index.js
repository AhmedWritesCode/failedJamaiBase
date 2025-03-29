const ReceiptProcessor = require('./receiptProcessor');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const inputPath = process.argv[2];
    
    if (!inputPath) {
      logger.error('Usage: node index.js <path-to-receipt-image-or-folder>');
      process.exit(1);
    }

    const processor = new ReceiptProcessor();
    const stats = fs.statSync(inputPath);
    
    if (stats.isFile()) {
      const result = await processor.processReceipt(inputPath);
      if (result) {
        logger.info('\nRECEIPT PROCESSING RESULT:');
        logger.info('----------------------------------------');
        logger.info(`Shop Name: ${result.shop_name}`);
        logger.info(`Total: ${result.total}`);
        logger.info('----------------------------------------');
      } else {
        logger.error('Failed to process receipt');
      }
    } else if (stats.isDirectory()) {
      const results = await processor.processReceiptBatch(inputPath);
      
      logger.info('\nBATCH PROCESSING SUMMARY:');
      logger.info('========================================');
      
      results.forEach((result, index) => {
        logger.info(`Result ${index + 1}:`);
        logger.info(`File: ${result.filename}`);
        logger.info(`Shop Name: ${result.shop_name}`);
        logger.info(`Total: ${result.total}`);
        logger.info('----------------------------------------');
      });
      
      logger.info(`Successfully processed ${results.length} of ${fs.readdirSync(inputPath).length} files`);
      logger.info('========================================');
    } else {
      logger.error('Input path is neither a file nor a directory');
    }
  } catch (error) {
    logger.error(`Application error: ${error.message}`);
    process.exit(1);
  }
}

main();